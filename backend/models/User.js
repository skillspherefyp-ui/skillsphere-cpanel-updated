const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true // Made nullable for OAuth users
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('student', 'instructor', 'admin'),
    allowNull: false,
    defaultValue: 'student'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  permissions: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
    get() {
      const rawValue = this.getDataValue('permissions');
      if (!rawValue) {
        return this.role === 'instructor' ? {} : null;
      }
      // MariaDB returns JSON columns as LONGTEXT strings — parse if needed
      if (typeof rawValue === 'string') {
        try { return JSON.parse(rawValue); } catch { return {}; }
      }
      return rawValue;
    }
  },
  profilePicture: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  // OTP Fields
  otpCode: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  otpExpiry: {
    type: DataTypes.DATE,
    allowNull: true
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // OAuth Fields
  googleId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  authProvider: {
    type: DataTypes.ENUM('local', 'google'),
    defaultValue: 'local'
  },
  instructorSignature: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: 'Instructor handwritten signature as base64 PNG (shared across all their certificate templates)'
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  qualification: {
    type: DataTypes.STRING,
    allowNull: true
  },
  privacyPolicyAccepted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  privacyPolicyAcceptedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  tokenVersion: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  failedLoginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  lockedUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'users',
  indexes: [
    { unique: true, fields: ['email'],    name: 'users_email_unique' },
    { unique: true, fields: ['googleId'], name: 'users_google_id_unique' },
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

// Instance method to compare password
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = User;
