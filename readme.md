# Player Death Animation & Retry System – AI Implementation Prompt

## Objective

Add a **visual death animation and retry system** that triggers when the player dies in either **Fall Mode or Climb Mode**.

The goal is to make the death moment feel **impactful and polished**, instead of instantly resetting the game. After the animation completes, the player should be presented with a **Retry option**.

This system must work consistently for both gameplay modes.

---

# Death Trigger

The death sequence must start when the player collides with a fatal object.

Example conditions:

```id="d1"
player hits obstacle
player crushed by crusher
player touches hazard
```

When death occurs:

```id="d2"
gameState = "DEATH_ANIMATION"
```

The normal gameplay loop must pause.

---

# Death Animation Sequence

The death animation should last **1.5 to 2 seconds** and include the following effects.

### 1. Impact Freeze (Hit Stop)

When the collision occurs:

```id="d3"
freezeGame = 150ms
```

This creates a dramatic moment before the animation begins.

---

### 2. Player Knockback / Spin

The player should react to the hit by:

* spinning
* slightly bouncing upward
* falling downward

Example logic:

```javascript id="d4"
player.rotation += rotationSpeed
player.velocity.y += gravity
```

Rotation example:

```id="d5"
rotationSpeed = 20 deg/frame
```

---

### 3. Particle Explosion

Spawn particles at the collision point.

Particles should resemble:

* sparks
* debris
* fragments

Example:

```id="d6"
spawnParticles(player.x, player.y, 20)
```

Particles fade out gradually.

---

### 4. Screen Shake

Add a strong screen shake effect.

Example:

```id="d7"
shakeIntensity = 25
shakeDuration = 400ms
```

This makes the impact feel powerful.

---

# Death Fall Animation

After the hit reaction, the player continues falling briefly.

Example:

```javascript id="d8"
player.velocity.y += gravity * 2
```

The player should fall off-screen or fade out.

---

# Transition to Game Over Screen

After the animation finishes:

```id="d9"
gameState = "GAME_OVER"
```

The game over screen should fade in smoothly.

Fade duration:

```id="d10"
500ms
```

---

# Game Over UI

Display the following elements:

### Title

```id="d11"
"Game Over"
```

---

### Player Score

Display the score achieved during the run.

Example:

```id="d12"
Score: 1240
```

---

### High Score

Retrieve from local storage.

Example:

```id="d13"
High Score: 2780
```

---

### Retry Button

Provide a clear retry button.

Button text:

```id="d14"
Retry
```

Button behavior:

```id="d15"
restartGame()
```

This resets:

* player position
* score
* obstacle pool
* world speed
* difficulty level

---

# Optional UI Enhancements

Add the following effects to improve polish.

### Slow Fade Background

Darken the background slightly.

Example:

```id="d16"
backgroundOpacity = 0.5
```

---

### Retry Button Animation

The retry button should appear with a small bounce animation.

Example:

```id="d17"
scale from 0.8 → 1.0
duration 300ms
```

---

# Restart Logic

When the retry button is pressed:

```id="d18"
gameState = "PLAYING"
```

Reset all gameplay systems.

Example reset tasks:

```id="d19"
resetPlayer()
resetObstacles()
resetScore()
resetWorldSpeed()
clearParticles()
```

---

# Integration Requirements

The death animation system must work in:

```id="d20"
FallMode.js
ClimbMode.js
```

It should be controlled from a shared state manager.

Do not duplicate code for each mode.

---

# Performance Requirements

Ensure:

* particles are limited
* no memory leaks
* animation does not create new objects every frame

Example particle limit:

```id="d21"
MAX_PARTICLES = 150
```

---

# Final Goal

The death moment should feel **dramatic and satisfying**, followed by a smooth transition into a **retry screen** that encourages players to immediately start another run.
