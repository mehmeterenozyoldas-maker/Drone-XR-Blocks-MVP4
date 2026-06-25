# Virtual Portals MVP Plan

## 5-Phase Development Roadmap

### Phase 1: Core Portal Mechanics & XR/VR Toggling (MVP Foundation)
- Structure: Add two distinct 3D visual portal frames in the main AR scene. 
- Trigger: Detect when the drone's position intersects with the portal boundaries.
- Transition Logic: Upon intersection, transition the WebXR session from AR passthrough mode (XR) to a fully enclosed VR environment.
- Escape Button: Implement a UI button / spatial button to switch back from the VR world to the original AR world.

### Phase 2: "Ancient Greek Techno" VR World
- Environment: Load 3D models of ruined ancient Greek pillars, marble temples, and starry skies. 
- Visuals: Add neon accents, glitch effects, and volumetric fog to blend the ancient theme with a cyberpunk techno aesthetic.
- Audio Sync: Configure the generative `TechnoDroneSynth` to shift scales or instruments to a Phrygian/Greek scale with heavier bass synths.

### Phase 3: "Holy Temple Techno" VR World
- Environment: Load 3D models of towering temple archways, floating glowing runes, and sacred geometry structures.
- Visuals: Integrate golden light shafts, glowing ethereal spheres, and crystalline textures. 
- Audio Sync: Configure the synth for ambient pads, choral harmonic resonance, and energetic high-BPM arpeggios suitable for a "Holy Temple" techno vibe.

### Phase 4: Advanced World Details & Transitions
- Transition FX: Add a warp-speed or light-tunnel transition effect when passing through the portal to smooth the XR->VR shift.
- Advanced Shaders: Apply custom shaders to the VR environments (e.g., distortion, holographic pulses) to increase visual fidelity.
- Drone Modification: In VR, the drone's visuals trace neon trails reflecting the specific world's color palette.

### Phase 5: Spatial AI Integration & World Interaction
- Gemini Integration: Allow the Gemini AI Scanner to recognize and describe elements in the VR worlds.
- Interactions: The drone can trigger music loops or reveal hidden temple structures by flying through specific waypoints in the VR worlds.

## Execution Steps

**Step 1:** Establish the `PortalManager` class to handle positional distance checks between the Drone and the Portal coordinates.
**Step 2:** Refactor the WebXR session management to allow switching between immersive-ar (AR) and immersive-vr (VR), including the UI switch button.
**Step 3:** Integrate Three.js `GLTFLoader` to spawn the ancient greek and temple components in isolated SceneGroups.
**Step 4:** Hook the audio synthesizer state to the currently active environment type (Default AR, Greek VR, Temple VR).
**Step 5:** Polish the textures, lighting, and volumetric bounds of the VR environments for maximum immersion.
