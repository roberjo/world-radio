# World Radio

An interactive web application for exploring and listening to radio stations from around the world. Discover local broadcasts through an intuitive map interface, featuring a radio scanner and random station discovery.

![World Radio Screenshot](https://via.placeholder.com/800x400/0a0a0f/ffffff?text=World+Radio+Map)

## 🌟 Features

- **Interactive World Map**: Visualize radio stations geographically using Leaflet maps
- **Radio Scanner**: Scan through frequencies to discover active stations
- **Random Station**: Get surprised with a random station from anywhere in the world
- **Real-time Streaming**: Listen to live radio broadcasts with HLS.js support
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Fast Search**: Quickly find stations by location or genre

## 🚀 Live Demo

[View Live Demo](https://yourusername.github.io/world-radio/)

*Replace `yourusername` with your actual GitHub username*

## 🛠️ Tech Stack

- **Frontend**: TypeScript, HTML5, CSS3
- **Build Tool**: Vite
- **Mapping**: Leaflet with Supercluster for performance
- **Streaming**: HLS.js for audio playback
- **API**: Radio Browser API for station data

## 📦 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/world-radio.git
   cd world-radio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

## 🏗️ Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## 🚀 Deploy to GitHub Pages

1. Build the project:
   ```bash
   npm run build
   ```

2. Commit and push your changes to GitHub.

3. Enable GitHub Pages in your repository settings:
   - Go to Settings → Pages
   - Select "Deploy from a branch"
   - Choose the `main` branch and `/dist` folder
   - Save

Your site will be available at `https://yourusername.github.io/world-radio/`

## 📱 Usage

- **Browse Map**: Click on map markers to listen to stations
- **Scanner**: Use the scanner button to tune through frequencies
- **Surprise Me**: Click for a random station experience
- **Search**: Filter stations by country, language, or tags

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Radio station data provided by [Radio Browser](https://www.radio-browser.info/)
- Map tiles courtesy of OpenStreetMap contributors
- Icons from various open source projects

## 📞 Support

If you have any questions or issues, please open an issue on GitHub.
