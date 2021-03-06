'use strict';

import 'source-map-support/register';
import basicAuth from 'basic-auth';
import bcrypt from 'bcrypt';
import pam from 'authenticate-pam';
import RED from 'node-red';

class Authenticator {

  constructor(sessionExpiryTime=12 * 60 * 60) {
    this.sessionExpiryTime = sessionExpiryTime;
  }

  init() {
    return {
      sessionExpiryTime: this.sessionExpiryTime,
      type: 'credentials',
      users: this.users.bind(this),
      authenticate: this.authenticate.bind(this)
    };
  }

  users(username) {
    let user = {
      username: username,
      permissions: '*'
    };
    return Promise.resolve(user);
  }

  apiBasicAuthMiddleware(req, res, next) {
    if (req.method === 'OPTIONS') {
        return next();
    }
    let requestUser = basicAuth(req);
    if (!requestUser) {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
      return res.sendStatus(401);
    }
    this.authenticate(requestUser.name, requestUser.pass).then(user => {
      if (user) {
        next();
      } else {
        res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
        res.sendStatus(401);
      }
    }).catch(err => {
      next(err);
    });
  }

  static areDefaultOrWeakCreds(username, password) {
    return (username === 'pi' && password === 'raspberry') ||
      (password && password.length < 8) ||
      (username === password);
  }

  testDefaultOrWeakCreds(username, password) {
    if (Authenticator.areDefaultOrWeakCreds(username, password)) {
      setTimeout(() => {
        RED.comms.publish('notification/rpi-default-password-alert', {
          type: 'warning',
          timeout: 60 * 1000,
          text: `[SECURITY WARNING] Change default or weak [${username}] user password!!!`
        }, false);
      }, 2000);
    }
  }
}

export class SingleUserAuthenticator extends Authenticator {
  constructor(sessionExpiryTime, username, password) {
    super(sessionExpiryTime);
    this.username = username;
    this.password = password;
  }

  authenticate(username, password) {
    return new Promise(resolve => {
      this.users(username).then((user) => {
        bcrypt.compare(password, this.password, (_, res) => {
          this.testDefaultOrWeakCreds(username, password);
          resolve(res ? user : null);
        });
      }).catch(() => {
        resolve(null);
      });
    });
  }

}

export class PAMAuthenticator extends Authenticator {
  constructor(sessionExpiryTime) {
    super(sessionExpiryTime);
  }

  authenticate(username, password) {
    return new Promise(resolve => {
      this.users(username).then((user) => {
        pam.authenticate(username, password, (err) => {
          this.testDefaultOrWeakCreds(username, password);
          resolve(err ? null : user);
        });
      }).catch(() => {
        resolve(null);
      });
    });
  }

}
