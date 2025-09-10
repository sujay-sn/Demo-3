# Demo 3 - Health Insurance Plan Management API

A RESTful API service for managing health insurance plans with advanced features including caching, real-time indexing, authentication, and data validation. Built with Node.js, Express, Redis, Elasticsearch, and RabbitMQ.

## Features

- **CRUD Operations**: Full Create, Read, Update, Delete, and Patch operations for health insurance plans
- **Data Validation**: JSON Schema validation using AJV
- **Authentication**: Google OAuth2 integration and JWT token-based authentication
- **Caching**: Redis-based caching with ETag support for optimized performance
- **Real-time Indexing**: Elasticsearch integration with RabbitMQ message queuing
- **Microservices Architecture**: Modular service-oriented design
- **Docker Support**: Complete containerized setup with docker-compose

## Architecture

The application follows a microservices architecture with the following components:

- **API Layer**: Express.js REST API with middleware support
- **Caching Layer**: Redis for high-performance data caching
- **Search Engine**: Elasticsearch for advanced querying and analytics
- **Message Queue**: RabbitMQ for asynchronous processing
- **Authentication**: OAuth2 with Google and JWT tokens
- **Validation**: JSON Schema validation for data integrity

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: Redis (primary storage)
- **Search Engine**: Elasticsearch 7.12.0
- **Message Queue**: RabbitMQ 3.8
- **Authentication**: Google OAuth2, JWT
- **Validation**: AJV (JSON Schema)
- **Containerization**: Docker, Docker Compose

## Prerequisites

- Node.js 8+
- Docker & Docker Compose
- Git
- Redis (if running without Docker)
- Elasticsearch (if running without Docker)
- RabbitMQ (if running without Docker)

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Demo\ 3
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

The application uses configuration from `config/local.json`. Update the following settings as needed:

```json
{
    "PORT": 3000,
    "REDIS_URL": "redis://your-redis-url",
    "JWT_SECRET": "your-jwt-secret",
    "RABBITMQ_QUEUE_NAME": "demo3-info7255",
    "ELASTICSEARCH_INDEX_NAME": "indexplan"
}
```

### 4. Start Services with Docker

```bash
docker-compose up
```

This will start:
- Elasticsearch on port 9200
- Kibana on port 5601
- RabbitMQ on ports 5672 (AMQP) and 15672 (Management UI)

### 5. Run the Application

#### Production Mode
```bash
npm start
```

#### Development Mode
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/token` | Generate JWT token |
| POST | `/v1/validate` | Validate JWT token |

### Plan Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/v1/plan` | Create a new plan | Yes |
| GET | `/v1/plan/:objectId` | Retrieve a plan | Yes |
| PUT | `/v1/plan/:objectId` | Update a plan (full replacement) | Yes |
| PATCH | `/v1/plan/:objectId` | Update a plan (additive merge) | Yes |
| DELETE | `/v1/plan/:objectId` | Delete a plan | Yes |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Application health status |

## Plan Schema

Plans must conform to the following JSON schema structure:

```json
{
    "objectId": "string",
    "objectType": "plan",
    "planType": "string",
    "creationDate": "string",
    "_org": "string",
    "planCostShares": {
        "objectId": "string",
        "objectType": "membercostshare",
        "deductible": "integer",
        "copay": "integer",
        "_org": "string"
    },
    "linkedPlanServices": [
        {
            "objectId": "string",
            "objectType": "planservice",
            "_org": "string",
            "linkedService": {
                "objectId": "string",
                "objectType": "service",
                "name": "string",
                "_org": "string"
            },
            "planserviceCostShares": {
                "objectId": "string",
                "objectType": "membercostshare",
                "deductible": "integer",
                "copay": "integer",
                "_org": "string"
            }
        }
    ]
}
```

## Authentication

### Google OAuth2
1. Set the `CLIENT_ID` environment variable
2. Include the Bearer token in the Authorization header:
   ```
   Authorization: Bearer <google-oauth-token>
   ```

### JWT Authentication
1. Get a token from `/v1/token`
2. Use the token in subsequent requests

## ETag Support

The API supports conditional requests using ETags:

- **GET requests**: Returns `304 Not Modified` if `If-None-Match` header matches current ETag
- **PUT/PATCH/DELETE requests**: Requires `If-Match` header with current ETag for optimistic locking

## Message Queue Integration

The application uses RabbitMQ for asynchronous processing:

- **Plan Creation/Update**: Sends `STORE` operation to queue for Elasticsearch indexing
- **Plan Deletion**: Sends `DELETE` operation to queue for Elasticsearch removal

## Elasticsearch Integration

### Index Structure
- **Index Name**: `indexplan` (configurable)
- **Parent-Child Relationships**: Uses join fields for hierarchical plan data
- **Real-time Indexing**: Automatic indexing via RabbitMQ messages

### Sample Queries
The `ElasticsearchQueries` file contains example queries for:
- Full-text search
- Conditional filtering
- Parent-child relationships
- Wildcard searches

## Development

### Project Structure
```
Demo 3/
├── config/              # Configuration files
├── src/
│   ├── controllers/     # Request handlers
│   ├── middlewares/     # Express middlewares
│   ├── models/          # JSON schemas
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   └── validations/     # Validation utilities
├── static/              # Static files and test data
└── docker-compose.yml   # Docker configuration
```

### Key Services

- **Redis Service**: Handles caching, ETag management, and data storage
- **Plan Service**: Business logic for plan CRUD operations
- **Elasticsearch Service**: Search indexing and document management
- **RabbitMQ Service**: Message queue producer/consumer
- **JWT Service**: Token generation and validation
- **JSON Schema Service**: Data validation

## Monitoring & Management

### Service URLs
- **Elasticsearch**: http://localhost:9200
- **Kibana Console**: http://localhost:5601/app/dev_tools#/console
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

### Docker Management

Delete all containers and volumes:
```bash
docker rm -vf $(docker ps -aq)
```

Delete all images:
```bash
docker rmi -f $(docker images -aq)
```

## Testing

Use the provided test plan in `static/plan.test.json` for API testing.

### Example cURL Request

```bash
# Create a plan
curl -X POST http://localhost:3000/v1/plan \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @static/plan.test.json
```

## Error Handling

The API returns appropriate HTTP status codes:

- `200`: Success
- `201`: Created
- `304`: Not Modified (ETag match)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized
- `404`: Not Found
- `409`: Conflict (resource already exists)
- `412`: Precondition Failed (ETag mismatch)

## Security Features

- Google OAuth2 integration
- JWT token-based authentication
- Input validation with JSON Schema
- CORS support
- Request rate limiting (via ETag caching)

## Contributing

1. Follow the existing code structure and patterns
2. Ensure proper error handling and validation
3. Update tests when adding new features
4. Maintain the API documentation

## License

ISC License