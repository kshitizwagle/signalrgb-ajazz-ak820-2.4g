# AJAZZ AK820 2.4G — SignalRGB plugin

Per-key lighting for the **AJAZZ AK820 / AK820 Pro** in SignalRGB while it's connected through its **2.4G wireless dongle**.

SignalRGB's built-in SONIX plugin already handles the keyboard over USB; this plugin covers the dongle, which uses a different protocol.

| Device | Vendor ID | Product ID |
|---|---|---|
| AJAZZ AK820 2.4G dongle ("2.4G Dongle") | `0x0C45` | `0xFDFD` |

## Install

**As a SignalRGB add-on:** add this repository's URL as an add-on in SignalRGB. SignalRGB clones it and keeps it updated:

```
https://github.com/kshitizwagle/signalrgb-ajazz-ak820-2.4g
```

**Manually:** copy `Ajazz_AK820_2.4G.js` into `Documents\WhirlwindFX\Plugins` and restart SignalRGB.

Close the AJAZZ driver software before using it, otherwise both will fight over the lighting.

## ⚠️ Read this before using animated effects

Over 2.4G, **every colour update is saved to the keyboard's flash memory** (the colours survive a power cycle). Flash has limited write endurance, so this plugin deliberately:

- only sends when the colours actually change,
- waits at least **2 seconds** between updates (setting: *Seconds Between Updates*, minimum 1),
- repeats the latest frame once to repair any packet the radio dropped.

Static colours and slow effects work fine. Fast animated effects will update slowly, and running them on the wireless keyboard all day means thousands of flash writes. For animated effects, use the keyboard wired (SignalRGB's built-in plugin), or use the keyboard's own built-in effects when wireless.

The keyboard also redraws top-to-bottom while an update arrives, so each update shows a brief wipe. That's the keyboard firmware, not something the plugin can avoid.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Lighting Mode | Canvas | Canvas follows the active effect; Forced uses one colour |
| Packet Delay (ms) | 6 | Gap between radio packets. Below 5 ms packets get lost |
| Seconds Between Updates | 2 | Higher = fewer flash writes |

## Protocol notes

Reverse-engineered by capturing the AJAZZ AK820Pro driver's traffic to the dongle and testing on the keyboard.

- Vendor interface 3 (usage page `0xFF60`, usage `0x61`), 32-byte output reports (+ report ID 0).
- Byte 31 of every packet is a checksum: the low byte of the sum of bytes 0–30.
- Per-key mode: `05 10 00 80 … [12]=brightness 0-5 … [17..18]=AA 55`.
- Colour data: `14 1C <block>` + 28 bytes, 20 blocks of 7 LEDs as `[led index, R, G, B]`. Receiving block N blanks every LED after it, so blocks must be sent in ascending order.
- Commit: `14 10 14 … [17..18]=AA 55`.
- The 64-byte interface 4 ignores colour data. Packets sent right after the mode packet or the `20 01` heartbeat are dropped while the keyboard is busy.

The LED index map and key layout are the same as the AK820 layout in SignalRGB's SONIX plugin.
