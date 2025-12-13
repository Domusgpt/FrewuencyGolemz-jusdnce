
# SYSTEM LOGIC: The Kinetic Graph Architecture

**Version:** 2.5
**Philosophy:** "Generative Structure" - Using mathematical rules to constrain and direct AI creativity.

This document details the "Secret Sauce" behind how jusDNCE balances consistency with variety.

---

## 1. MACHINE VISION: The Asset Strategy

The AI doesn't just generate pictures; it generates a **Structured Rig**. We use a combination of Generative AI and "Machine Frames" (procedural assets) to create a full animation deck.

### A. The Reference Loop (Consistency)
To ensure the character looks the same across 64 frames (Super Mode), we use a recursive prompting strategy:
1.  **Base Sheet (Groove):** Generated first from the user's source image.
2.  **Context Injection:** The *output* of the Base Sheet is fed back into Gemini as the `contextImage` for the Alt, Flourish, and Details sheets.
3.  **Result:** The model "sees" what the character is wearing and replicates it in the new poses.

### B. Machine Frames (Variety)
We artificially inflate the frame count using local canvas operations.
*   **Mirrors (🪞):** Every "Left" move is flipped to create a "Right" move. This is standard.
*   **Mandalas (💠):** For Hand sheets, we take the left half of the image, mirror it, and stitch it to the right half. This creates a symmetrical, psychedelic "Voguing" effect.
*   **Virtual Crops (🔮):** 
    *   **Logic:** We take high-quality `closeup` frames and create a duplicate entry in the rig with `virtualZoom: 1.5`.
    *   **Effect:** This allows the sequencer to "Cut" to a closeup, then "Morph" to a super-closeup without generating a new image. It creates a "Dolly Zoom" sensation.

---

## 2. THE KINETIC GRAPH: The Sequencer

The `loop()` function in `Step4Preview.tsx` is a state machine that decides *what* to show based on *frequency*.

### Audio-to-Motion Mapping
| Audio Frequency | Sequence Mode | Camera Behavior | Frame Pool |
| :--- | :--- | :--- | :--- |
| **Bass (0-50Hz)** | `GROOVE` | **Headbang:** Pitch (X-Axis) rotation. | Body (Low/Mid Energy) |
| **Mid (200-500Hz)** | `IMPACT` | **Sway:** Yaw (Y-Axis) rotation + Stutter. | Hands, High Energy Body |
| **High (2kHz+)** | `EMOTE` | **Dolly Zoom:** Camera Z-Axis push. | Face Closeups |
| **Rhythm Gate** | `FOOTWORK` | **Pan Down:** Camera Y-Axis slide (-150px). | Feet / Shoes |

### The "Hard Cut" Philosophy
We prioritize rhythm over smoothness.
*   **Default:** We use `CUT` (0ms transition) for all body moves. This matches the "TikTok" / "Stop Motion" aesthetic.
*   **Exception:** We use `MORPH` (200ms transition) *only* when entering/exiting `EMOTE` mode (Closeups). This makes the face feel "liquid" while the body remains snappy.

---

## 3. CAMERA COUPLING: The Physics Engine

The camera is not keyframed; it is a **Physical Object** attached to springs.

### The Spring Solver
`Force = (Target - Current) * Stiffness - (Velocity * Damping)`

*   **Reactivity Slider:** Directly multiplies the input force.
    *   At **0%**: The camera is static.
    *   At **100%**: The camera swings 35 degrees on every kick drum.
*   **Headbanging:** The `masterRotX` (Pitch) is driven directly by the `Bass` value.
*   **Page Turn Effect:** We do not use 3D CSS. We use `2.5D` canvas scaling (`scaleX = cos(rotationY)`). This creates the illusion of a flat card rotating in 3D space, which preserves the pixel-art/sharp aesthetic of the source images.

---

## 4. DIVERSITY STRATEGY

How do we keep it from getting boring?

1.  **Stutter Engine:** If `Mids > 0.6`, there is a random chance to re-trigger the *same frame* with a `1.2x` squash effect. This looks like a video glitch.
2.  **Chaos Factor:** The `Chaos` slider introduces a random probability to jump to `IMPACT` mode regardless of the audio.
3.  **Role Prompting:** We explicitly ask Gemini for different "Roles" in each sheet:
    *   `Sheet 1`: "Step Left / Right" (Structure)
    *   `Sheet 2`: "Jump / Spin" (Action)
    *   `Sheet 3`: "Voguing / Mudras" (Style)
    *   `Sheet 4`: "Shoe Closeups" (Texture)

This layered approach ensures that even a 4-second loop feels alive because the Camera, The Frame, and The Effects are all dancing to different parts of the frequency spectrum.
