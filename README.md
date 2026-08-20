# 🎬 Savannah Cinemas

A full-featured cinema booking and movie discovery web application with user authentication, watchlist management, and ticket booking capabilities.

![Savannah Cinemas](https://img.shields.io/badge/Savannah-Cinemas-gold?style=for-the-badge&logo=cinema)
![Node.js](https://img.shields.io/badge/Node.js-18.x-green?style=flat-square&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Screenshots](#screenshots)
- [Contributing](#contributing)
- [License](#license)

---

## 📖 Overview

**Savannah Cinemas** is a modern cinema management system that allows users to:

- Browse popular and upcoming movies
- Search for films using the TMDB API
- Create accounts and manage profiles
- Add movies to a personal watchlist
- Mark films as watched or favorite
- Book tickets for showtimes
- View booking history
- Track viewing statistics

The application features a dark-themed, responsive UI built with vanilla JavaScript, HTML, and CSS, with a Node.js backend using file-based storage.

---

## ✨ Features

### 🎯 User Authentication
- Register with email and password
- Secure login with JWT tokens
- Password reset via email
- Profile management
- Session persistence

### 🎬 Movie Discovery
- Browse popular movies from TMDB
- Search for any film
- View detailed movie information
- See cast and crew
- Watch trailers
- Infinite scroll on discovery page

### ⏰ Coming Soon
- View upcoming films
- Filter by year and sort by various criteria
- Get notifications for upcoming releases
- Add upcoming films to watchlist

### ❤️ Watchlist
- Add/remove films from watchlist
- Mark films as watched/unwatched
- Mark films as favorites
- Filter by watched, unwatched, or favorites
- Sort by newest, oldest, rating, or title
- Track viewing statistics

### 🎟️ Ticket Booking
- Select showtime and screen
- Choose number of tickets
- Interactive seat selection
- Add snacks and drinks
- View booking summary
- Checkout and confirmation

### 📊 User Profile
- View watchlist
- See booking history
- Track movie statistics
- Genre preference analysis
- Account settings

---

## 🛠️ Tech Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Custom properties, flexbox, grid, responsive design
- **Vanilla JavaScript** - No frameworks, pure JS
- **Font Awesome** - Icons
- **Google Fonts** - Inter, Oswald, Playfair Display

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **Nodemailer** - Email service
- **dotenv** - Environment variables

### APIs
- **TMDB API** - Movie data (popular, upcoming, search, details)
- **Gmail SMTP** - Email notifications

### Storage
- **File-based JSON** - No database required for this version

---

## 📁 Project Structure

```
savannah-cinemas/
├── server.js                 # Main backend server
├── package.json              # Node.js dependencies
├── .env                      # Environment variables
├── data.json                 # User and watchlist storage
├── password.txt              # App password storage
├── index.html                # Homepage
├── auth.html                 # Login/Register page
├── coming-soon.html          # Upcoming films page
├── discovery.html            # Movie discovery page
├── movie-details.html        # Movie details page
├── booking.html              # Seat selection page
├── checkout.html             # Checkout page
├── profile.html              # User profile page
├── seats.html                # Alternative seat selection
├── events.html               # Events page
├── extras.html               # Extras page
├── images/                   # Image assets
│   ├── popcorn-image.jpg
│   ├── coke-image.jpg
│   ├── malta-guinness.jpg
│   ├── fanta-image.jpg
│   └── sprite-image.jpg
└── README.md                 # This file
```

---

## 🚀 Installation

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **TMDB API Key** ([Get one here](https://www.themoviedb.org/signup))
- **Gmail Account** (for email features)

### Setup Steps

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/savannah-cinemas.git
cd savannah-cinemas
```

2. **Install dependencies**

```bash
npm install
```

3. **Create a `.env` file** in the root directory

```env
# Server Configuration
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Gmail SMTP Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-digit-app-password

# Optional: TMDB API Key (already in frontend)
TMDB_API_KEY=your-tmdb-api-key
```

4. **Get a Gmail App Password**

   - Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" as the app
   - Select "Other" as the device
   - Copy the 16-character password
   - Add it to your `.env` file

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 5000) | No |
| `JWT_SECRET` | Secret for JWT tokens | Yes |
| `GMAIL_USER` | Gmail address for sending emails | No |
| `GMAIL_APP_PASSWORD` | Gmail app password | No |

### TMDB API Key

The TMDB API key is embedded in the frontend JavaScript files. You can replace it with your own:

```javascript
const API_KEY = 'your-tmdb-api-key';
```

Files containing the API key:
- `index.html`
- `coming-soon.html`
- `discovery.html`
- `movie-details.html`
- `booking.html`
- `seats.html`

---

## ▶️ Running the Application

### Development Mode

```bash
node server.js
```

The server will start at: `http://localhost:5000`

### Access on Other Devices

To access from your phone or other devices on the same network:

1. **Find your IP address**

   - Windows: `ipconfig` → IPv4 Address
   - Mac/Linux: `ifconfig` or `ip addr` → inet

2. **Update the API URLs** in all HTML files to use your IP:

```javascript
// Replace localhost with your IP
const API_URL = 'http://192.168.1.100:5000/api';
```

3. **Update server.js** to listen on all interfaces:

```javascript
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
```

4. **Access from any device** using: `http://YOUR_IP:5000`

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/request-reset` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |

### Watchlist

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/watchlist` | Get user's watchlist |
| POST | `/api/watchlist` | Add film to watchlist |
| DELETE | `/api/watchlist/:filmId` | Remove film from watchlist |
| POST | `/api/watchlist/toggle-watched` | Toggle watched status |
| POST | `/api/watchlist/toggle-favorite` | Toggle favorite status |

### Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookings` | Get user's bookings |
| POST | `/api/bookings` | Create a booking |

### Email

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/send-booking-email` | Send booking confirmation email |

---

## 📸 Screenshots

### Homepage
![Homepage](https://via.placeholder.com/800x400?text=Homepage)

### Movie Details
![Movie Details](https://via.placeholder.com/800x400?text=Movie+Details)

### Seat Selection
![Seat Selection](https://via.placeholder.com/800x400?text=Seat+Selection)

### User Profile
![User Profile](https://via.placeholder.com/800x400?text=User+Profile)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
```bash
git checkout -b feature/amazing-feature
```
3. **Commit your changes**
```bash
git commit -m 'Add amazing feature'
```
4. **Push to the branch**
```bash
git push origin feature/amazing-feature
```
5. **Open a Pull Request**

### Coding Standards

- Use consistent indentation (2 spaces)
- Write meaningful commit messages
- Test your changes before submitting
- Update the README if needed

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [TMDB](https://www.themoviedb.org/) for the movie database API
- [Font Awesome](https://fontawesome.com/) for icons
- [Google Fonts](https://fonts.google.com/) for typography
- [Unsplash](https://unsplash.com/) for placeholder images

---

## 📞 Support

For support, email support@savannahcinemas.com or open an issue on GitHub.

---

## 🚧 Roadmap

- [ ] Mobile app using React Native
- [ ] Social sharing features
- [ ] Reviews and ratings
- [ ] Loyalty program
- [ ] Real-time seat availability
- [ ] Payment integration
- [ ] Admin dashboard
- [ ] Email newsletter integration

---

**Built with ❤️ by the Savannah Cinemas Team**
