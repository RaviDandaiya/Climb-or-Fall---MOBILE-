# FreeFall JS

FreeFall JS is a **mobile-optimized 2D infinite falling survival game** built using **JavaScript and HTML5 Canvas**.

Players guide a character through an endless cavern while avoiding obstacles, collecting coins, and surviving an ever-increasing difficulty curve.

The game is designed for **smooth 60 FPS gameplay on mobile and desktop browsers**.

---

# Core Game Concept

Unlike traditional falling games where the player moves downward, FreeFall JS uses an **inverted world system**.

The player remains vertically fixed while:

* platforms and obstacles move upward
* procedural terrain is generated endlessly
* the difficulty increases with depth

This architecture allows infinite gameplay while keeping performance stable.

---

# Gameplay Overview

The goal is simple:

* survive as long as possible
* collect coins
* navigate increasingly difficult platform patterns
* avoid crushers and deadly obstacles

The deeper the player falls, the more dangerous the cavern becomes.

---

# Main Features

## Infinite Procedural Gameplay

Platforms and obstacles are generated dynamically using procedural rules.

The game world continuously scrolls upward while the player falls deeper into the cavern.

---

# Control System

The game supports two input systems simultaneously.

### Tilt Controls

Uses the device orientation sensor.

```javascript
DeviceOrientationEvent.gamma
```

Logic:

```javascript
if (Math.abs(gamma) > deadZone) {
    player.vx += gamma * sensitivity;
}
```

Dead zone:

```
2 degrees
```

This prevents jitter when holding the phone steady.

---

### Touch Buttons

Two overlay buttons:

* LEFT
* RIGHT

While a button is pressed:

```javascript
player.vx += acceleration
```

Velocity is capped:

```
player.maxSpeed
```

---

# Movement Physics

Movement includes friction to create smooth deceleration.

```javascript
player.vx *= 0.9
```

This prevents sudden stops and makes tilt controls feel natural.

---

# Procedural Platform System

Platforms are generated dynamically as the player falls.

Platform types include:

* Standard platforms
* Slalom gap platforms
* Breakable glass platforms
* Horizontal crushers

Object pooling is used to recycle platforms for performance.

Platforms are recycled when leaving the screen.

```javascript
if (platform.y < -platform.height)
    recyclePlatform()
```

---

# Progressive Difficulty System

Difficulty increases based on player depth.

As the player falls deeper:

* platform gaps become narrower
* crushers move faster
* platform patterns become more complex

Gap width scaling:

```javascript
gapWidth = Math.max(minGap, baseGap - depth * difficultyFactor)
```

Example values:

```
baseGap = 80
difficultyFactor = 0.15
minGap = player.width * 1.5
```

---

# New Obstacle Types

## Horizontal Crushers

Crushers appear in deeper sections of the cavern.

They consist of two heavy blocks that move toward each other horizontally.

Behavior:

* spawn with a center gap
* slide inward over time
* crushing the player causes instant game over

Crusher speed scales with difficulty.

```javascript
crusherSpeed = baseCrusherSpeed + depth * 0.01
```

---

## Breakable Glass Platforms

Glass platforms are fragile.

When the player lands on them while falling downward:

* the platform shatters
* a violent screen shake occurs
* glass particles scatter
* the player is forced into a rapid freefall

Impact condition:

```javascript
player.velocity.y > 0
```

Effects include:

* screen shake
* particle fragments
* temporary velocity boost

---

# Power-Ups

The game contains several collectible power-ups.

## Shield

Protects the player from a single collision.

---

## Magnet

Pulls nearby coins toward the player.

Coins smoothly curve toward the player when magnet is active.

---

## Heavy Anchor

A powerful temporary ability.

When collected:

* the player becomes extremely heavy
* falling speed increases
* platforms are smashed through on contact

Duration:

```
5 seconds
```

While anchor mode is active:

* standard platforms break instantly
* score increases rapidly
* passive coins are rewarded

Crushers remain lethal to maintain challenge.

---

# Coin System

Coins spawn randomly inside platform gaps.

Collecting a coin:

```
+50 score
```

Coins animate using sprite frames.

Magnet power-ups attract coins toward the player.

---

# Scoring System

Score increases with distance traveled.

```
Score = floor(totalDistance / 10)
```

Bonus points:

* coins
* anchor smash events
* optional near-miss bonuses

---

# Near-Miss Bonus System

Optional advanced mechanic.

If the player passes extremely close to crushers or walls without touching them:

* sparks appear
* score bonus is awarded
* combo multiplier increases

This encourages skilled risky movement.

---

# High Score Persistence

High scores are stored using:

```
localStorage
```

Key:

```
freefall_highscore
```

The high score appears on:

* start screen
* game over screen

---

# Game States

The engine supports three game states.

```
START
PLAYING
GAMEOVER
```

### Start Screen

Displays:

* game title
* high score
* start button

---

### Playing

The full gameplay loop is active.

---

### Game Over

Displays:

* final score
* high score
* restart option

---

# Renderer

The game uses a single responsive HTML5 canvas.

Canvas size automatically adjusts to the screen.

```javascript
canvas.width = window.innerWidth
canvas.height = window.innerHeight
```

---

# Performance Targets

The game must maintain:

```
60 FPS
```

Optimization strategies include:

* object pooling
* minimal DOM operations
* single canvas rendering
* capped particle systems

Particle limit example:

```
MAX_PARTICLES = 150
```

---

# Asset Loading

Assets are loaded before the game loop starts using a Promise-based loader.

Assets include:

* player sprite
* platform textures
* coin animation
* power-up visuals

---

# Running the Game

Clone the repository:

```
git clone https://github.com/yourname/freefall-js.git
```

Run a development server:

```
npm run dev
```

or open:

```
index.html
```

---

# Future Improvements

Possible future additions:

* sound effects and music
* additional power-ups
* biome themes for deeper levels
* particle lighting effects
* online leaderboards
* daily challenge modes

---

# License

This project is open source and available under the MIT License.

---

# Author

FreeFall JS is designed as a **modular JavaScript game project demonstrating procedural generation, physics systems, and mobile-friendly browser gameplay.**
