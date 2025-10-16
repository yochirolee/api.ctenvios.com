# API Key System Documentation

Welcome to the CTEnvios API Key System documentation. This folder contains comprehensive guides for implementing, using, and maintaining the secure API key authentication system.

## 📚 Documentation Overview

### 1. [API Key Guide](./API_KEY_GUIDE.md)

**For: Partners and API Consumers**

Complete user guide for working with API keys, including:

-  Security features and best practices
-  API endpoint reference
-  Authentication methods
-  Rate limiting
-  Error handling
-  Code examples (Node.js, Python)
-  Troubleshooting guide

**Start here if you're:** A partner integrating with the API or need to understand how to use API keys.

---

### 2. [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)

**For: Developers and Technical Team**

Technical implementation details covering:

-  Files created and modified
-  Security improvements comparison
-  Database schema changes
-  Code conventions applied
-  Testing recommendations
-  Performance considerations
-  Deployment checklist

**Start here if you're:** A developer working on the codebase or reviewing the implementation.

---

### 3. [Migration Guide](./MIGRATION_GUIDE.md)

**For: DevOps and Database Administrators**

Step-by-step migration instructions including:

-  Schema changes explained
-  Database backup procedures
-  Migration commands
-  Data migration scripts
-  Rollback procedures
-  Partner communication templates
-  Verification checklist

**Start here if you're:** Deploying the API key system or managing the database migration.

---

## 🚀 Quick Start

### For Partners (API Users)

1. Contact your admin to create an API key
2. Read the [API Key Guide](./API_KEY_GUIDE.md)
3. Store your key securely
4. Test authentication
5. Integrate into your application

### For Developers

1. Review [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
2. Understand the code changes
3. Run tests
4. Review security considerations
5. Deploy following the checklist

### For DevOps

1. Read [Migration Guide](./MIGRATION_GUIDE.md)
2. Backup the database
3. Run migration scripts
4. Verify all systems
5. Monitor for issues

---

## 🔐 Security Features

Our API key system implements:

✅ **SHA-256 Hashing** - Keys never stored in plain text  
✅ **Cryptographic Generation** - 256-bit random keys  
✅ **Key Prefixes** - `ct_live_` and `ct_test_` for easy identification  
✅ **Expiration Support** - Optional expiration dates  
✅ **Multiple Keys** - Enable zero-downtime rotation  
✅ **Activity Tracking** - Monitor last_used timestamp  
✅ **Soft Deletion** - Revoke without permanent deletion  
✅ **Rate Limiting** - Per-partner request limits  
✅ **Audit Logging** - Complete request history

---

## 📋 Key Concepts

### API Key Format

```
ct_{environment}_{random_string}
│   │             │
│   │             └─ 43-character base64url encoded string
│   └─ "live" or "test"
└─ CTEnvios prefix
```

**Examples:**

-  `ct_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v`
-  `ct_test_x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f`

### Key Lifecycle

```
Create → Active → [Revoked] → [Deleted]
   │                  ↑
   └──────────────────┘
   (rotation process)
```

1. **Create**: Generate new key with optional expiration
2. **Active**: Key is valid and can authenticate
3. **Revoke**: Soft delete (can be restored if needed)
4. **Delete**: Permanent removal (ROOT only)

---

## 🔗 Related Documentation

-  [Partners API Documentation](../../PARTNERS_API_DOCUMENTATION.md) - Full partner API reference
-  [Project README](../../README.md) - Main project documentation
-  [Stress Testing Guide](../../README-STRESS-TESTING.md) - Performance testing

---

## 📊 File Structure

```
docs/
└── api-keys/
    ├── README.md                    # This file - Documentation index
    ├── API_KEY_GUIDE.md            # User guide for API consumers
    ├── IMPLEMENTATION_SUMMARY.md    # Technical implementation details
    └── MIGRATION_GUIDE.md          # Database migration instructions
```

---

## 🛠️ Implementation Files

The API key system is implemented across these files:

### Core Files

-  `src/utils/apiKeyUtils.ts` - Key generation and hashing utilities
-  `src/repository/partners.repository.ts` - Database operations
-  `src/controllers/partners.controller.ts` - Business logic
-  `src/middlewares/partner-auth-middleware.ts` - Authentication
-  `src/routes/partners.routes.ts` - API endpoints
-  `prisma/schema.prisma` - Database schema

### Database Models

-  `Partner` - Partner account information
-  `ApiKey` - API key storage (hashed)
-  `PartnerLog` - Request audit logs

---

## 📞 Support & Contact

### For Technical Issues

-  Review troubleshooting sections in relevant guides
-  Check system logs
-  Contact: dev-team@ctenvios.com

### For Partner Support

-  Email: support@ctenvios.com
-  Check API status: https://status.ctenvios.com

### For Security Concerns

-  Email: security@ctenvios.com
-  Report vulnerabilities responsibly

---

## 🔄 Version History

| Version | Date         | Changes                              |
| ------- | ------------ | ------------------------------------ |
| 1.0     | January 2025 | Initial release with hashed API keys |

---

## ✅ Documentation Checklist

When updating this documentation:

-  [ ] Update all affected guide files
-  [ ] Update version numbers
-  [ ] Update code examples to match current API
-  [ ] Test all code examples
-  [ ] Review security recommendations
-  [ ] Update migration guides for new changes
-  [ ] Notify relevant teams of updates

---

## 📖 How to Contribute

To improve this documentation:

1. Identify gaps or errors
2. Create clear, tested examples
3. Follow existing formatting style
4. Update all related sections
5. Submit for review

---

## 🎓 Learning Resources

### Understanding API Keys

-  [OWASP API Security](https://owasp.org/www-project-api-security/)
-  [OAuth 2.0 vs API Keys](https://www.oauth.com/oauth2-servers/access-tokens/)

### Best Practices

-  [API Key Management Best Practices](https://cloud.google.com/docs/authentication/api-keys)
-  [Secure Key Storage](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)

### TypeScript & Node.js

-  [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
-  [Prisma Documentation](https://www.prisma.io/docs/)

---

**Last Updated:** January 2025  
**Maintained By:** CTEnvios Development Team  
**Documentation Version:** 1.0
