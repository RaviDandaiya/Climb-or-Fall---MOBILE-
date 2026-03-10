# Fall Mode Difficulty Ramp – AI Implementation Prompt

## Objective

Redesign **Fall Mode** so that the gameplay begins with **very easy obstacles** and gradually increases in difficulty as the player survives longer or falls deeper.

The goal is to create a **smooth onboarding experience** where new players learn the controls without feeling overwhelmed, while experienced players eventually face intense survival challenges.

Difficulty must increase **progressively and predictably**, not randomly.

---

# Core Design Principle

The first seconds of gameplay must **teach the player how to control the character**.

To achieve this:

* Start with **small obstacles and wide open spaces**
* Gradually introduce **larger hazards**
* Later introduce **complex obstacle structures**

This prevents players from being scared or frustrated at the start and increases player retention.

---

# Difficulty Scaling System

Difficulty should be controlled using a **stage-based progression system**.

Difficulty stages must be calculated based on:

```
time survived
or
distance fallen
```

Example:

```
difficultyLevel = floor(timeSurvived / 20)
```

or

```
difficultyLevel = floor(depth / 100)
```

The difficulty level will determine:

* obstacle size
* obstacle spawn rate
* obstacle complexity
* world velocity

---

# Stage 1 – Beginner (0–15 seconds)

Purpose: **Teach player movement and controls**

Spawn only **small, simple obstacles**.

Obstacle examples:

* small rocks
* small monsters
* single hazards

Characteristics:

* large empty spaces
* slow world speed
* low spawn rate
* no complex patterns

Players should have plenty of time to react.

Example pattern:

```
     O

        O
   O
```

---

# Stage 2 – Early Challenge (15–40 seconds)

Purpose: **Introduce basic navigation challenges**

Obstacle types:

* medium rocks
* moving creatures
* small obstacle clusters

Characteristics:

* slightly increased world speed
* moderate spawn frequency
* simple gap patterns

Example pattern:

```
   O     O

       O
  O
```

Players begin needing quick reactions.

---

# Stage 3 – Intermediate (40–80 seconds)

Purpose: **Increase tension and reaction difficulty**

Obstacle types:

* larger hazards
* rotating blades
* small crusher traps

Characteristics:

* tighter gaps
* faster world velocity
* multiple obstacles appearing simultaneously

Example pattern:

```
 O  O  O

     gap
 O       O
```

Players must navigate precisely.

---

# Stage 4 – Advanced (80+ seconds)

Purpose: **High-intensity survival gameplay**

Obstacle types:

* large platform-sized obstacles
* horizontal crushers
* rotating traps
* obstacle walls

Characteristics:

* narrow gaps
* fast obstacle movement
* dense hazard clusters

Example pattern:

```
████    ████
   gap

  █████████
```

This stage should feel intense and require skill.

---

# Progressive Obstacle Introduction

Obstacle types must unlock gradually.

Example progression:

Stage 1

* small rocks

Stage 2

* medium hazards
* monsters

Stage 3

* rotating blades
* crusher traps

Stage 4

* large platform obstacles
* complex obstacle walls

This creates the feeling that the player is **falling deeper into a more dangerous cavern**.

---

# Spawn System

Obstacle spawning should use a **difficulty-based spawn table** instead of pure randomness.

Example logic:

```
if difficultyLevel == 0
spawnSmallObstacle()

if difficultyLevel == 1
spawnMediumObstacle()

if difficultyLevel >= 2
spawnLargeObstacle()
```

Spawn rate should increase gradually as well.

---

# Difficulty Scaling Parameters

The difficulty system must control the following values:

World speed:

```
worldVelocity = baseSpeed + difficultyLevel * speedIncrease
```

Spawn rate:

```
spawnInterval = max(minSpawnTime, baseSpawnTime - difficultyLevel * reductionRate)
```

Obstacle size:

```
obstacleScale = baseSize + difficultyLevel * sizeIncrease
```

All values must be clamped to prevent impossible gameplay.

---

# Player Experience Goals

The player experience should feel like:

```
calm start
↓
learning controls
↓
reacting to obstacles
↓
precision navigation
↓
high-speed survival
```

The difficulty curve must feel **fair and rewarding**.

---

# Performance Requirements

Maintain:

* stable 60 FPS
* object pooling for obstacles
* no new object creation inside the game loop
* capped particle effects

Example:

```
MAX_PARTICLES = 150
```

---

# Integration Rules

The difficulty ramp must be implemented inside:

```
FallMode.js
```

Do not modify:

```
ClimbMode.js
core renderer
input handler
```

---

# Final Goal

The Fall Mode gameplay should feel like a **journey into an increasingly dangerous cavern**, where:

* early gameplay is relaxing and approachable
* mid-game becomes reactive and challenging
* late-game becomes intense survival
