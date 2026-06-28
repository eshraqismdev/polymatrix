# Polymatrix

[![Live Demo](https://img.shields.io/badge/Live%20Demo-%23000000?style=for-the-badge&logo=vercel&logoColor=white)](https://smc.eshraqism.com/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/eshraqismdev/polymatrix)

A modern, full-stack web application built with Next.js, Tailwind CSS, shadcn/ui, TypeScript, and Prisma. This project provides a robust foundation for building scalable web applications with an elegant user interface and type-safe database operations.

**[🌐 View Live Demo](https://smc.eshraqism.com/)** | **[📖 View Repository](https://github.com/eshraqismdev/polymatrix)**

## 🔗 Live Demo

Experience the application in action:

- **Website**: [https://smc.eshraqism.com/](https://smc.eshraqism.com/)
- **Repository**: [https://github.com/eshraqismdev/polymatrix](https://github.com/eshraqismdev/polymatrix)

## ✨ Features

- **Full-Stack Framework**: Next.js 16+ with App Router and API Routes
- **Type Safety**: TypeScript throughout the entire codebase
- **UI Components**: Comprehensive component library using shadcn/ui with Radix UI primitives
- **Database**: Prisma ORM with SQLite for data persistence
- **Styling**: Tailwind CSS v4 with custom animations and responsive design
- **Authentication**: Next Auth integration ready
- **Form Management**: React Hook Form with Zod validation
- **Data Fetching**: TanStack React Query for efficient server state management
- **Rich Editor**: MDX Editor integration for content creation
- **Internationalization**: next-intl support for multi-language applications
- **Development Tools**: ESLint, TypeScript strict mode, Hot module replacement

## 🛠 Tech Stack

- **Frontend**: React 19, Next.js 16
- **Styling**: Tailwind CSS v4, shadcn/ui
- **Language**: TypeScript 5
- **Database**: Prisma + SQLite
- **State Management**: Zustand, TanStack React Query
- **Forms**: React Hook Form, Zod
- **UI Utilities**: Radix UI, Framer Motion, Lucide Icons
- **Runtime**: Bun
- **Package Manager**: Bun

## 📋 Prerequisites

- **Node.js** >= 18.x or **Bun** >= 1.3.x
- **npm**, **yarn**, **pnpm**, or **bun** as package manager
- Git for version control

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/eshraqismdev/polymatrix.git
cd polymatrix
```

### 2. Install Dependencies

Using Bun (recommended):
```bash
bun install
```

Or using npm:
```bash
npm install
```

### 3. Setup Environment Variables

Create a `.env.local` file in the root directory:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

### 4. Initialize Database

Push the Prisma schema to your database:

```bash
bun run db:push
# or
npm run db:push
```

Generate Prisma client:

```bash
bun run db:generate
# or
npm run db:generate
```

### 5. Run Development Server

Start the development server:

```bash
bun run dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see your application.

## 📚 Available Scripts

### Development

```bash
# Start development server with hot reload
bun run dev

# Run ESLint to check code quality
bun run lint
```

### Database

```bash
# Push Prisma schema changes to database
bun run db:push

# Generate Prisma Client
bun run db:generate

# Run database migrations
bun run db:migrate

# Reset database (WARNING: deletes all data)
bun run db:reset
```

### Production

```bash
# Build for production
bun run build

# Start production server
bun run start
```

## 📁 Project Structure

```
polymatrix/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/                # API routes
│   │   └── layout.tsx          # Root layout
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   └── terminal/           # Custom components
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utility functions
│   └── styles/                 # Global styles
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
├── public/                     # Static assets
├── package.json                # Project dependencies
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
└── next.config.ts              # Next.js configuration
```

## 🗄 Database Schema

### User Model

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Post Model

```prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## 🎨 UI Components

The project includes a comprehensive set of UI components from shadcn/ui:

- **Navigation**: Menubar, Navigation Menu, Sidebar
- **Forms**: Input, Textarea, Select, Checkbox, Radio Group, Switch, Toggle
- **Dialogs**: Dialog, Alert Dialog, Drawer, Popover
- **Data Display**: Table, Accordion, Tabs, Carousel, Progress
- **Feedback**: Toast, Tooltip
- **And many more!**

Browse the `src/components/ui` directory to explore all available components.

## 🔐 Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL="file:./dev.db"

# Next Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret"

# Add other environment variables as needed
```

## 🚀 Deployment

### Current Deployment

This project is currently deployed and running at: **[https://smc.eshraqism.com/](https://smc.eshraqism.com/)**

### Deploy to Vercel (Recommended)

Click the button below to deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Feshraqismdev%2Fpolymatrix)

Or manually:

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Configure environment variables in Vercel dashboard
4. Deploy with one click

### Deploy to Other Platforms

This project can be deployed to any platform that supports Node.js:

- **Railway**: Push to GitHub and connect
- **Render**: Simple deployment with GitHub integration
- **Heroku**: Use the Node.js buildpack
- **Docker**: The project can be containerized

### Environment Variables for Production

Make sure to set these in your deployment platform's dashboard:

```
DATABASE_URL=your_production_database_url
NEXTAUTH_URL=your_production_domain
NEXTAUTH_SECRET=generate_a_strong_secret
```

## 🤝 Contributing

Contributions are welcome! Here's how to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the project's ESLint configuration and includes appropriate TypeScript types.

## 📝 License

This project is open source and available under the MIT License. See the LICENSE file for more details.

## 💬 Support

If you encounter any issues or have questions:

1. Check the [Next.js documentation](https://nextjs.org/docs)
2. Review [Prisma documentation](https://www.prisma.io/docs/)
3. Explore [shadcn/ui components](https://ui.shadcn.com/)
4. Open an issue on GitHub

## 🔗 Useful Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)

---

Built with ❤️ using Next.js and Tailwind CSS
