# test-middleware

A production-ready backend API

Built with [create-backend-quickstart](https://www.npmjs.com/package/create-backend-quickstart) - A comprehensive, production-ready backend boilerplate generator.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your database credentials and other settings

# Using Docker (Recommended)
docker-compose up -d

# Run migrations
docker-compose exec app npm run migrate

# Run seeders (optional)
docker-compose exec app npm run seed


```

## 📁 Project Structure

```
test-middleware/
├── src/
│   ├── api/v1/                 # API routes and controllers
│   │   ├── routes/             # Express routes
│   │   ├── controllers/        # Request handlers  
│   │   ├── services/           # Business logic
│   │   └── validators/         # Request validation
│   ├── config/                 # Configuration files
│   ├── core/                   # Core application logic
│   │   ├── database/          # Database models and repositories
│   │   ├── errors/            # Custom error classes
│   │   └── utils/             # Utility functions
│   ├── shared/                # Shared middleware and services
│   └── app.ts                    # Application entry point
├── tests/                     # Test files
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests  
│   └── helpers/               # Test utilities
├── docker-compose.yml       # Development environment
├── docker-compose.prod.yml   # Production environment
├── Dockerfile                # Container definition
└── README.md                 # This file
```

## 🛠️ Available Scripts

### Development
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run build:watch  # Build in watch mode
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run format       # Format code with Prettier
```

### Database
```bash
npm run migrate      # Run database migrations
npm run migrate:undo # Rollback last migration
npm run seed         # Run database seeders
npm run seed:undo    # Rollback seeders
```

### Testing
```bash
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:unit    # Run unit tests only
npm run test:integration # Run integration tests only
```

### Docker
```bash
npm run docker:build # Build Docker image
npm run docker:up   # Start Docker containers
npm run docker:down # Stop Docker containers
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and update the following variables:

```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=test-middleware_development
DB_USERNAME=postgres
DB_PASSWORD=your_password



# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@test-middleware.com
```

## 📊 API Documentation

### Swagger/OpenAPI
- **Development**: http://localhost:3000/docs
- **Staging**: https://staging-api.test-middleware.com/docs
- **Production**: https://api.test-middleware.com/docs

### Core Endpoints

#### Health Check
```
GET /health
```

#### Authentication
```
POST /api/v1/auth/register     # User registration
POST /api/v1/auth/login        # User login  
POST /api/v1/auth/refresh      # Refresh tokens
POST /api/v1/auth/logout       # User logout
POST /api/v1/auth/forgot-password # Request password reset
POST /api/v1/auth/reset-password   # Reset password
GET  /api/v1/auth/me          # Get current user profile
```

#### Users Management
```
GET    /api/v1/users          # Get users list (paginated)
GET    /api/v1/users/:id      # Get user by ID
POST   /api/v1/users          # Create new user
PUT    /api/v1/users/:id      # Update user
DELETE /api/v1/users/:id      # Delete user (soft delete)
```

## 🏗️ Architecture

### Design Patterns
- **Repository Pattern**: Database access abstraction
- **Service Layer**: Business logic separation
- **Controller Pattern**: Request handling
- **Middleware Pattern**: Cross-cutting concerns

### Security Features
- JWT-based authentication with refresh tokens
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting
- CORS protection
- Security headers (Helmet.js)
- XSS and injection protection

### Database Features
- ORM with Sequelize
- Database migrations and seeders
- Connection pooling
- Transaction support
- Soft deletes
- Audit trails (created_at, updated_at)

## 🧪 Testing

The project includes comprehensive testing setup:

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test API endpoints and database interactions
- **Test Helpers**: Utilities for creating test data and assertions
- **Coverage Reports**: Aim for 80%+ coverage

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=auth

# Run tests in watch mode
npm run test:watch
```

## 🐳 Docker Deployment

### Development Environment
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Environment
```bash
# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Or use the deployment script
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Services Included
- **App**: Main application container
- **PostgreSQL**: Database server

- **Redis**: Caching and session storage
- **Nginx**: Reverse proxy and load balancer

## 📈 Monitoring & Logging

### Health Checks
- Application health: `GET /health`
- Database connectivity checks
- External service dependency checks

### Logging
- Structured logging with Winston
- Log rotation and archival
- Different log levels per environment
- Request/response logging

### Metrics
- Application performance metrics
- Database query performance
- API response times
- Error tracking and alerting

## 🔒 Security Best Practices

✅ **Authentication & Authorization**
- JWT tokens with proper expiration
- Refresh token rotation
- Role-based access control

✅ **Input Validation**
- Request payload validation
- SQL injection prevention
- XSS protection

✅ **Security Headers**
- CORS configuration
- Content Security Policy
- X-Frame-Options, X-XSS-Protection

✅ **Rate Limiting**
- API endpoint protection
- Login attempt limiting
- IP-based restrictions

## 🚀 Production Deployment

### Pre-deployment Checklist
- [ ] Update environment variables
- [ ] Run database migrations
- [ ] Update API documentation
- [ ] Run security scan
- [ ] Verify SSL certificates
- [ ] Test health endpoints
- [ ] Configure monitoring alerts

### Deployment Strategies
1. **Docker Compose**: Simple single-server deployment
2. **Kubernetes**: Scalable container orchestration
3. **Cloud Platforms**: AWS ECS, Google Cloud Run, etc.

### Performance Optimization
- Enable gzip compression
- Use CDN for static assets  
- Database query optimization
- Connection pooling
- Caching strategies with Redis

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Standards
- Follow ESLint and Prettier configurations
- Write tests for new features
- Update documentation
- Follow conventional commit format

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@test-middleware.com
- 💬 Discord: [Join our community](https://discord.gg/test-middleware)
- 📚 Documentation: [docs.test-middleware.com](https://docs.test-middleware.com)
- 🐛 Issues: [GitHub Issues](https://github.com//test-middleware/issues)

---

**Built with ❤️ using [create-backend-quickstart](https://www.npmjs.com/package/create-backend-quickstart)**