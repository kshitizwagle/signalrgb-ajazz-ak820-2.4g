# AJAZZ AK820 2.4G — SignalRGB plugin

Per-key lighting for the **AJAZZ AK820 / AK820 Pro** in SignalRGB while it's connected through its **2.4G wireless dongle**.

**This plugin is for still colours.** For animated effects or screen ambience, use the USB cable with SignalRGB's built-in SONIX plugin. [Flash wear over 2.4G](#️-flash-wear-over-24g) explains why.

| Device | Vendor ID | Product ID |
|---|---|---|
| AJAZZ AK820 2.4G dongle ("2.4G Dongle") | `0x0C45` | `0xFDFD` |

## Install

**As a SignalRGB add-on:** add this repository's URL as an add-on in SignalRGB. SignalRGB clones it and keeps it updated:

```
https://github.com/kshitizwagle/signalrgb-ajazz-ak820-2.4g
```

**Manually:** close SignalRGB, copy `Ajazz_AK820_2.4G.js` into `Documents\WhirlwindFX\Plugins`, then start it again.

Close the AJAZZ driver software before using it, otherwise both will fight over the lighting.

## Which connection to use

| Lighting | Connection |
|---|---|
| Still colours | 2.4G or USB |
| Animated effects | USB |
| Screen ambience | USB |

For USB, connect the cable and put the keyboard in wired mode. SignalRGB's built-in SONIX plugin handles it from there, and this plugin isn't involved.

## ⚠️ Flash wear over 2.4G

Over 2.4G, **every colour update erases and rewrites the same 1 KB block of the keyboard's flash memory**. The chip is rated for 20,000 erase cycles at minimum and about 100,000 typically, and this link has no per-key colour command that avoids the erase. Streaming an animation at 5 to 6 frames a second would reach the minimum rating in about an hour.

USB doesn't have this problem: in the firmware, live colours sent over USB go to RAM with no erase.

So this plugin only sends on a trigger:

- a sudden change on the canvas: you switched effect, or the screen content changed,
- the canvas holding still on new colours for a second: for example you edited a static colour,
- the plugin's Lighting Mode or Forced Color setting changing.

Each update is repeated once, 2 seconds later, to repair any packet the radio dropped, so an update costs 2 erases. The next update then waits at least **30 seconds** (setting: *Minimum Seconds Between Updates*, minimum 5). Closing SignalRGB sends one more frame for the shutdown colour.

| On the canvas | Erases per hour | Time to 20,000 erases |
|---|---|---|
| Still colour | 0 after the first update | never |
| Smooth animation | 0 after the first update | never |
| Constant hard cuts (screen ambience, flashing effects) | up to about 220 | about 90 hours |

These figures are for the default 30-second gap. At the 5-second minimum, the worst case rises to about 1,030 erases per hour, or about 20 hours to 20,000.

### Limitations

- **Animated effects show as a still image.** The keyboard gets one frame when the effect starts and stays on it, because smooth animation is deliberately not a trigger.
- **Switching between two animated effects can be missed.** SignalRGB doesn't tell plugins which effect is running, so the plugin can only judge by how suddenly the colours change. If the change is gradual, nothing triggers until the canvas holds still. Lower *Change Threshold* if this happens often.
- **Changes inside the gap wait.** A colour edited soon after an update appears when the gap ends, up to about 30 seconds later by default.
- **Keys blank and refill during each update.** The keyboard draws its keys from the block being rewritten, so this can't be avoided.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Lighting Mode | Canvas | Canvas follows the active effect; Forced uses one colour |
| Packet Delay (ms) | 6 | Gap between radio packets. Below 5 ms packets get lost |
| Minimum Seconds Between Updates | 30 | Shortest gap between triggered updates, from 5 to 300. Lower values respond faster and wear the flash faster |
| Change Threshold | 12 | How sudden a change must be to trigger an update (average per colour channel, 0-255) |

## Protocol notes

Reverse-engineered by capturing the AJAZZ AK820Pro driver's traffic to the dongle, testing on the keyboard, and reading the stock V1.13 firmware (PID `0x8009`). Other firmware versions may differ.

- Vendor interface 3 (usage page `0xFF60`, usage `0x61`), 32-byte output reports (+ report ID 0).
- Byte 31 of every packet is a checksum: the low byte of the sum of bytes 0–30.
- Per-key mode: `05 10 00 80 … [12]=brightness 0-5 … [17..18]=AA 55`.
- Colour data: `14 1C <block>` + 28 bytes, 20 blocks of 7 LEDs as `[led index, R, G, B]`. The keyboard writes each block straight to flash at `0x9C00 + block * 28`, and block 0 erases that 1 KB page first. So block 0 must go first, the keys blank when it arrives and refill as later blocks land, and each LED must stay in its own slot.
- `14 10 14 … [17..18]=AA 55` is the last block of the table. The driver treats it as a commit, but the colours are already in flash by then.
- Music mode (`0B`) stays in RAM over 2.4G, but it only carries two palette colours and 17 column heights, so it can't show per-key colours.
- USB live colours, for comparison: `04 20 … [8..9]=report count`, then reports of 16 × `[led index, R, G, B]`, then `04 02`. These go to RAM.
- The 64-byte interface 4 ignores colour data. Packets sent right after the mode packet or the `20 01` heartbeat are dropped while the keyboard is busy.

The LED index map and key layout are the same as the AK820 layout in SignalRGB's SONIX plugin. Flash endurance is from the SN32F299 datasheet, p.264.

Related work: [fpb/ajazz-ak820-pro](https://github.com/fpb/ajazz-ak820-pro), [wsclx/ak820pro-modder](https://github.com/wsclx/ak820pro-modder), [shrey715/openajazz](https://github.com/shrey715/openajazz).
