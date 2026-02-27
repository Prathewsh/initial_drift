# Initial Drift

**Initial Drift** is a high-octane, low-poly drifting game built for the web. Experience the thrill of sliding through a stylized open world, inspired by classic arcade racers and the aesthetics of Initial D.

> [!IMPORTANT]
> **Alpha Release v0.0.1**
> This is the initial alpha build. We are actively working on improving physics, performance, and world assets!

---

## 🎮 Play the Game

### Local Setup
Due to browser security restrictions (CORS) regarding 3D models (`.glb` files), you **must** run this project through a local web server. Opening `index.html` directly in your browser will result in a security error.

**Recommended Methods:**
1.  **VS Code Live Server**: Install the extension and click "Go Live" at the bottom right.
2.  **Python**: Run `python -m http.server 8000` in the directory.
3.  **Node.js**: Run `npx serve` or `npm install -g serve`.

---

## ⌨️ Controls

| Key | Action |
| --- | --- |
| **W** | Accelerate |
| **S** | Brake / Reverse |
| **A / D** | Steering |
| **SPACE** | Handbrake (Initiate Drift) |
| **L** | Cruise Control (Lock Speed) |
| **ESC** | Pause / Menu |
| **ENTER** | Start Game (From Menu) |

---

## ✨ Features

-   **Custom Drift Physics**: A custom physics engine fine-tuned for satisfying, heavy-feeling drifts.
-   **Dynamic Camera**: GTA/Forza-inspired camera system that reacts to speed and rotation.
-   **Low-Poly Open World**: A procedural-style city layout with buildings, trees, and roads.
-   **Visual Effects**: Dynamic smoke particles that trigger during high-speed slides and handbrakes.
-   **Eurobeat Integration**: Built-in music system to keep the rhythm high while you drift.
-   **Responsive HUD**: Real-time speedometer and cruise control indicators.

---

## 🛠️ Technology Stack

-   **Engine**: [Three.js](https://threejs.org/) (WebGL)
-   **Frontend**: Vanilla HTML5, CSS3, JavaScript
-   **Assets**: GLB (Low Poly Models), JPG (Textures), MP3 (Eurobeat Soundtrack)
-   **Fonts**: Oswald, Bebas Neue, Inter

---

## 📝 License

This project is for educational and entertainment purposes. Inspired by the legends of the drift world.

*Enjoy the slide!* 🏁
