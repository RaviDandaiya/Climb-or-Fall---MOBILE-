# Fall Mode Speed Rebalance – AI Implementation Prompt

## Objective

The current falling speed in **Fall Mode** is too high, making it difficult for players to navigate obstacles and react properly.

The gameplay should begin with **very slow falling speed** to allow players to understand the controls and observe the environment.

The falling speed must then **increase gradually over time**, creating a smooth difficulty curve.

---

# Core Design Principle

The game should follow a **slow start → gradual acceleration → high-speed survival** structure.

Early gameplay should feel:

* calm
* readable
* forgiving

Later gameplay should feel:

* intense
* fast
* challenging

This prevents new players from quitting early due to difficulty.

---

# Starting Speed

Reduce the initial falling/world speed significantly.

Example values:

```id="s1"
startSpeed = 1.2
```

This is intentionally slow to give players time to adjust.

---

# Maximum Speed

The falling speed must have a limit to prevent impossible gameplay.

Example:

```id="s2"
maxSpeed = 10
```

The game should never exceed this value.

---

# Gradual Speed Increase

The speed should increase gradually based on **time survived or distance fallen**.

Example formula:

```javascript id="s3"
worldSpeed = startSpeed + (acceleration * timeAlive)
```

Example values:

```id="s4"
acceleration = 0.02
```

This creates a smooth speed ramp.

---

# Speed Clamping

Always clamp the final speed value:

```javascript id="s5"
worldSpeed = Math.min(worldSpeed, maxSpeed)
```

This ensures the game remains playable.

---

# Optional Depth-Based Scaling

Alternatively, speed can scale with player depth:

```javascript id="s6"
worldSpeed = startSpeed + (depth * 0.003)
```

Where:

```id="s7"
depth = distanceFallen
```

---

# Difficulty Milestones

To make the progression feel noticeable, define speed milestones.

Example:

| Time Survived | Speed    |
| ------------- | -------- |
| 0 sec         | 1.2      |
| 20 sec        | 2.0      |
| 40 sec        | 3.5      |
| 60 sec        | 5.5      |
| 90 sec        | 7.5      |
| 120+ sec      | 10 (max) |

The increase should feel **smooth and natural**, not sudden.

---

# Integration Requirements

This speed system must control the movement of:

```id="s8"
obstacles
coins
environment elements
```

Example:

```javascript id="s9"
obstacle.y -= worldSpeed
coin.y -= worldSpeed
```

---

# Player Experience Goal

The player experience should feel like:

```id="s10"
slow learning phase
↓
moderate reaction gameplay
↓
fast intense survival
```

Players should always feel that the game becomes faster because **they survived longer**, not because the game started unfairly fast.

---

# Performance Requirements

Ensure that the speed system:

* does not create sudden jumps in velocity
* updates smoothly each frame
* does not break object pooling

---

# Final Goal

Fall Mode should feel fair and approachable at the start while gradually becoming intense and challenging as the player survives longer.
