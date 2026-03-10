# Fall Mode Gameplay Redesign Specification

## Objective

Update **Fall Mode** so that the player is in **continuous free fall** through a vertical cavern while avoiding procedurally generated obstacles and collecting coins.

The existing **platform-based gameplay must be removed**.

Instead, the player falls continuously and must **steer left and right to avoid hazards**.

This creates a **reaction-based survival gameplay loop**.

The system must integrate with the existing architecture without affecting **Climb Mode**.

---

# Core Gameplay Loop

The player:

1. Falls continuously downward
2. Uses tilt or buttons to steer horizontally
3. Avoids obstacles
4. Collects coins
5. Survives as long as possible

Game ends when:

```id="a7x2y1"
player collides with obstacle
```

Score increases based on:

* survival time
* distance fallen
* coins collected

---

# World Movement System

Instead of moving the player downward, the world scrolls upward.

```javascript id="p2w5r9"
obstacle.y -= worldVelocity
coin.y -= worldVelocity
```

Player vertical position remains mostly fixed on screen.

---

# Player Physics

The player experiences **constant downward acceleration**.

Example:

```javascript id="c8d6y4"
player.velocity.y += gravity
```

Clamp maximum fall speed:

```javascript id="t4g9q1"
player.velocity.y = Math.min(player.velocity.y, maxFallSpeed)
```

Example values:

```id="u6n3k2"
gravity = 0.6
maxFallSpeed = 20
```

Horizontal movement remains controlled by tilt or buttons.

---

# Controls

## Tilt Control

Uses:

```id="z8m1v3"
DeviceOrientationEvent.gamma
```

Logic:

```javascript id="x5p7b4"
if (Math.abs(gamma) > deadZone) {
player.velocity.x += gamma * sensitivity
}
```

Dead zone:

```id="f3r2n1"
2 degrees
```

---

## Button Controls

Two overlay buttons:

```id="b6q4k9"
LEFT
RIGHT
```

When pressed:

```javascript id="m9e2c8"
player.velocity.x += acceleration
```

Velocity cap:

```id="h5t7s1"
player.maxSpeed
```

---

# Obstacle System

Platforms are removed completely.

Instead, the game generates **falling corridor obstacles**.

Obstacle types:

### 1 Wall Segments

Vertical rock formations that block parts of the cavern.

Example:

```
|   gap   |
|#### ####|
```

Player must steer through the gap.

---

### 2 Moving Crushers

Two horizontal blocks move toward each other.

If the player remains inside the gap too long they are crushed.

Movement example:

```javascript id="j3y9v2"
leftBlock.x += crusherSpeed
rightBlock.x -= crusherSpeed
```

Crusher speed increases with difficulty.

---

### 3 Rotating Blades

Circular rotating hazards placed in the fall path.

Behavior:

```javascript id="g7c2w5"
blade.rotation += rotationSpeed
```

Collision results in instant game over.

---

### 4 Laser Gates

Horizontal laser beams that activate periodically.

Logic example:

```javascript id="n8u5p3"
laser.active = time % 3 === 0
```

Players must time their fall.

---

# Procedural Generation

Obstacles spawn at the bottom of the screen.

```javascript id="d4s8v1"
spawnY = canvas.height + spawnBuffer
```

Random gap placement:

```javascript id="k9p6r3"
gapX = random(minX, maxX)
```

Gap width must always be greater than:

```id="y2m5f4"
player.width * 2
```

This ensures every obstacle is technically passable.

---

# Object Pooling

All obstacles must use object pooling.

Recycle objects when they leave the screen.

```javascript id="w3e6q8"
if (obstacle.y < -obstacle.height)
recycleObstacle()
```

This prevents garbage collection spikes.

---

# Coin System

Coins spawn randomly inside safe gaps.

Collecting a coin grants:

```id="s6t3v5"
+50 points
```

Coin behavior:

```javascript id="c2n7u9"
coin.y -= worldVelocity
```

Optional magnet power-up can attract nearby coins.

---

# Scoring System

Score is based on distance fallen.

Formula:

```id="e1v8r6"
score = floor(distanceFallen / 10)
```

Additional score sources:

```id="b7u4m2"
coin collection
near miss bonuses
```

---

# Difficulty Scaling

Difficulty increases as the player survives longer.

World velocity increases gradually.

Formula:

```id="z9k1n4"
Vy = Vstart + (BaseAcceleration * time)
```

Example values:

```id="p5x7g3"
Vstart = 3
BaseAcceleration = 0.03
maxVelocity = 12
```

Velocity must be clamped to maintain fairness.

---

# Collision System

Use **AABB collision detection**.

Check collisions between:

```id="r8m2j5"
player vs obstacles
player vs coins
```

Player hitbox should be slightly smaller than sprite.

```javascript id="t6y3q1"
hitbox = spriteSize * 0.9
```

---

# Game States

Fall Mode must support:

```id="k4f9w2"
START
PLAYING
GAMEOVER
```

---

# Performance Requirements

Maintain:

```id="v7b2n6"
60 FPS on mobile
```

Rules:

* no object creation inside the game loop
* use object pooling
* single canvas renderer
* particle effects must be capped

Example particle limit:

```id="a2r8c4"
MAX_PARTICLES = 150
```

---

# Integration Rules

The changes must affect only:

```id="u9p5s3"
FallMode.js
```

Do not modify:

```id="j6c2q8"
ClimbMode.js
core renderer
input handler
```

Fall Mode must remain compatible with the existing game engine.

---

# Goal

The redesigned Fall Mode should feel like:

* a **high-speed obstacle navigation game**
* similar to falling through a dangerous cavern
* focused on **reaction time and precision steering**
* optimized for **mobile tilt gameplay**
