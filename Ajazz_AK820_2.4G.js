export function Name() { return "AJAZZ AK820 (2.4G)"; }
export function VendorId() { return 0x0C45; }
export function ProductId() { return 0xFDFD; }
export function Publisher() { return "kshitizwagle"; }
export function Size() { return [15, 6]; }
export function DefaultPosition(){ return [10, 100]; }
export function DefaultScale(){ return 8.0; }
export function DeviceType(){ return "keyboard"; }
export function ImageUrl() { return "https://assets.signalrgb.com/devices/brands/ajazz/keyboards/ak820-pro.png"; }
/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
packetDelay:readonly
minInterval:readonly
*/
export function ControllableParameters(){
	return [
		{property:"shutdownColor", group:"lighting", label:"Shutdown Color", description: "This color is applied to the device when the System, or SignalRGB is shutting down", min:"0", max:"360", type:"color", default:"#000000"},
		{property:"LightingMode", group:"lighting", label:"Lighting Mode", description: "Determines where the device's RGB comes from. Canvas will pull from the active Effect, while Forced will override it to a specific color", type:"combobox", values:["Canvas", "Forced"], default:"Canvas"},
		{property:"forcedColor", group:"lighting", label:"Forced Color", description: "The color used when 'Forced' Lighting Mode is enabled", min:"0", max:"360", type:"color", default:"#009bde"},
		{property:"packetDelay", group:"", label:"Packet Delay (ms)", description: "Pause between radio packets. Raise this if some keys stay dark or show the old colour; below 5 ms packets get lost", step:"1", type:"number", min:"5", max:"30", default:"6"},
		{property:"minInterval", group:"", label:"Seconds Between Updates", description: "The keyboard saves every 2.4G colour update to its flash memory, which wears out with use. Keep this high: static colours are unaffected, animated effects update slowly", step:"0.5", type:"number", min:"1", max:"60", default:"2"},
	];
}

// The 2.4G dongle talks to the keyboard through 32-byte output reports on interface 3
// (usage page 0xFF60, usage 0x61). Every packet is [cmd..., checksum], where the checksum
// is the low byte of the sum of the 31 bytes before it. Captured from the AJAZZ AK820Pro driver.
const PACKET_LENGTH = 33; // report id + 32
const CHUNK_SIZE = 28;
const CHUNK_COUNT = 20;   // 20 x 28 bytes = 140 LEDs x [index, R, G, B]
const BRIGHTNESS = 5;     // 0-5, SignalRGB handles brightness itself

const vLedNames = [
	"Esc", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Del",
	"`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+", "Backspace", "Home",
	"Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\", "PgUp",
	"CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Enter", "PgDn",
	"Left Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift", "Up Arrow", "End",
	"Left Ctrl", "Left Win", "Left Alt", "Space", "Right Alt", "Fn", "Right Ctrl", "Left Arrow", "Down Arrow", "Right Arrow",
];

const vLeds = [
	1,   2,  3,  4,  5,  6,  7,  8,   9,  10, 11, 12, 13, 119,
	19,	20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,   103, 	  117,
	37,  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,   67, 	  118,
	55,   56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,     85, 	  121,
	73,    74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 	84,     101, 122,
	91, 92, 93,				94,			  95, 96, 98,   99, 100, 102,
];

const vLedPositions = [
	[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0],
	[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1],
	[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2],
	[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],		   [13, 3], [14, 3],
	[0, 4],         [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], [14, 4],
	[0, 5], [1, 5], [2, 5],							[6, 5],					[9, 5], [10, 5], [11, 5], [12, 5], [13, 5], [14, 5],
];

export function LedNames() { return vLedNames; }
export function LedPositions() { return vLedPositions; }

export function Validate(endpoint) {
	return endpoint.interface === 3 && endpoint.usage_page === 0xFF60;
}

// Chunks that hold no real LEDs can be skipped: anything not sent before a commit is dark anyway.
// Chunks must go out in ascending order - receiving chunk N blanks every LED after it.
const usedChunks = [...new Set(vLeds.map(led => Math.floor(led * 4 / CHUNK_SIZE)))].sort((a, b) => a - b);

// Over 2.4G every committed frame is written to the keyboard's flash (colours survive a power
// cycle), the keyboard is busy for a moment afterwards, and it redraws top-to-bottom while a frame
// arrives. So frames are only sent when the colours change, no more often than minInterval,
// plus one repeat of the latest frame to repair any packet the radio dropped.
let lastFrame = "";
let lastWrite = 0;
let repairPending = false;

export function Initialize() {
	device.set_endpoint(3, 0x0061, 0xFF60);
	lastFrame = "";
	lastWrite = 0;
	repairPending = false;

	// Switch to per-key custom mode (0x80) once. Packets sent right after it get lost, so wait.
	writePacket([0x05, 0x10, 0x00, 0x80, 0, 0, 0, 0, 0, 0, 0, 0, BRIGHTNESS, 0, 0, 0, 0, 0xAA, 0x55]);
	device.pause(500);
}

export function Render() {
	sendColors();
}

export function Shutdown(SystemSuspending) {
	const color = SystemSuspending ? "#000000" : shutdownColor;
	sendColors(color, true);
}

function sendColors(overrideColor, force) {
	const RGBData = new Array(CHUNK_SIZE * CHUNK_COUNT).fill(0);

	for (let iIdx = 0; iIdx < vLeds.length; iIdx++) {
		const [iPxX, iPxY] = vLedPositions[iIdx];
		let color;

		if(overrideColor){
			color = hexToRgb(overrideColor);
		}else if (LightingMode === "Forced") {
			color = hexToRgb(forcedColor);
		}else{
			color = device.color(iPxX, iPxY);
		}

		const led = vLeds[iIdx];
		RGBData[led * 4]     = led;
		RGBData[led * 4 + 1] = color[0];
		RGBData[led * 4 + 2] = color[1];
		RGBData[led * 4 + 3] = color[2];
	}

	const frame = RGBData.join(",");
	const now = Date.now();
	const changed = frame !== lastFrame;

	if(!changed && !repairPending && !force) {
		return;
	}

	if(!force && now - lastWrite < (Number(minInterval) || 2) * 1000) {
		return;
	}

	// A new frame gets one repeat later on; the repeat itself doesn't schedule another.
	repairPending = changed;
	lastFrame = frame;
	lastWrite = now;
	writeFrame(RGBData);
}

function writeFrame(RGBData) {
	const delay = Math.max(Number(packetDelay) || 6, 5);

	for (const chunk of usedChunks) {
		const start = chunk * CHUNK_SIZE;
		writePacket([0x14, 0x1C, chunk].concat(RGBData.slice(start, start + CHUNK_SIZE)));
		device.pause(delay);
	}

	// Commit
	writePacket([0x14, 0x10, 0x14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xAA, 0x55]);
}

function writePacket(body) {
	const packet = new Array(PACKET_LENGTH).fill(0);

	for (let i = 0; i < body.length && i < 31; i++) {
		packet[i + 1] = body[i];
	}

	let sum = 0;

	for (let i = 1; i < 32; i++) {
		sum += packet[i];
	}

	packet[32] = sum & 0xFF;
	device.write(packet, PACKET_LENGTH);
}

function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	const colors = [];
	colors[0] = parseInt(result[1], 16);
	colors[1] = parseInt(result[2], 16);
	colors[2] = parseInt(result[3], 16);

	return colors;
}
