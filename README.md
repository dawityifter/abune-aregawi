# Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church

A modern, bilingual church website built with React, Node.js, and Firebase.

## 🏗️ Project Structure

```
abune-aregawi/
├── frontend/                 # React + TypeScript + TailwindCSS
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── contexts/         # React contexts (Language, Auth)
│   │   ├── firebase.ts       # Firebase configuration
│   │   └── ...
│   ├── package.json
│   └── tailwind.config.js
├── backend/                  # Node.js + Express (coming soon)
├── package.json              # Root package.json with scripts
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation
```bash
# Install all dependencies (frontend + backend)
npm run install:all

# Or install individually:
npm install                    # Root dependencies
cd frontend && npm install     # Frontend dependencies
cd ../backend && npm install   # Backend dependencies (when ready)
```

### Development
```bash
# Start frontend only
npm run start:frontend

# Start backend only (when ready)
npm run start:backend

# Start both frontend and backend
npm run dev
```

### Build for Production
```bash
npm run build
```

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React + TypeScript + TailwindCSS | Modern, responsive UI |
| **Backend** | Node.js + Express | API and business logic |
| **Database** | PostgreSQL | Structured data storage |
| **Auth** | Firebase Auth | User authentication |
| **Deployment** | Vercel (frontend) + Railway/Render (backend) | Hosting |

## 🌐 Features

### ✅ Implemented
- **Bilingual Support**: English and Tigrigna languages
- **Responsive Design**: Mobile-first approach
- **Modern UI**: TailwindCSS with custom components
- **Language Persistence**: Remembers user's language preference
- **Cultural Design**: Respectful of Tigray Orthodox traditions

### 🚧 In Progress
- Firebase Authentication
- Backend API development
- Database integration
- Admin panel

### 📋 Planned
- Member portal
- Online giving
- Event management
- Email notifications
- PDF reports

## 🎨 Design Philosophy

- **Mobile-first**: Optimized for mobile devices
- **Culturally respectful**: Honors Tigray Orthodox Christian traditions
- **Accessible**: WCAG compliant design
- **Fast**: Optimized performance and loading times

## 🔧 Environment Variables

Create a `.env` file in the frontend directory:

```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is created for the Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church community.

---

*Built with love for the Tigray Orthodox Christian community* 