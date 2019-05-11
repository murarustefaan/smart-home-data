const Express     = require('express');
const Router      = Express.Router();
const StatusCodes = require('http-status-codes');
const _           = require('lodash');
const log         = require('debug')('app:routes:users');
const ObjectID    = require('mongodb').ObjectID;


const middleware = {

  create: {

    /**
     * Ensure new user is valid
     */
    validate: async (req, res, next) => {
      const validator         = req.app.locals.validator;
      const [ valid, errors ] = await validator.validate('user_create', req.body);

      if (!valid) {
        log(valid, errors);
        return res.status(StatusCodes.BAD_REQUEST)
                  .json({
                    status:  StatusCodes.BAD_REQUEST,
                    message: StatusCodes.getStatusText(StatusCodes.BAD_REQUEST)
                  });
      }

      req.context.user = { ...req.body };
      return next();
    },


    /**
     * Ensure user is unique in the database
     */
    ensureUnique: async (req, res, next) => {
      const { username } = req.context.user;

      try {
        const db   = req.app.locals.database.SmartHome;
        const user = await db.collection('users')
                             .findOne({ username });

        if (user) {
          log(`user ${username} already exists`);
          return res
            .status(StatusCodes.CONFLICT)
            .json({ message: StatusCodes.getStatusText(StatusCodes.CONFLICT), status: StatusCodes.CONFLICT });
        }
      } catch (e) {
        log(e);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR)
                  .json({
                    message: StatusCodes.getStatusText(StatusCodes.INTERNAL_SERVER_ERROR),
                    status:  StatusCodes.INTERNAL_SERVER_ERROR
                  });
      }

      return next();
    },

    /**
     * Save the user in the database
     */
    insert: async (req, res, next) => {
      const user        = req.context.user;
      user.createdAt    = Date.now();
      user.lastModified = Date.now();

      const db = req.app.locals.database.SmartHome;
      try {
        await db.collection('users').insertOne(user);
      } catch (e) {
        log(e);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR)
                  .json({
                    message: StatusCodes.getStatusText(StatusCodes.INTERNAL_SERVER_ERROR),
                    status:  StatusCodes.INTERNAL_SERVER_ERROR
                  });
      }

      req.context.user = _.omit(user, [ 'password', '__version' ]);
      return next();
    },

  },

  list: {

    find: async (req, res, next) => {
      const db  = req.app.locals.database.SmartHome;
      let users = [];

      const query = {};
      if (req.query.username) {
        query.username = req.query.username;
      }

      try {
        users = await db.collection('users')
                        .find(query)
                        .project({ _id: 1, username: 1 })
                        .toArray();
      } catch (e) {
        log(e);
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: StatusCodes.getStatusText(StatusCodes.BAD_REQUEST), status: StatusCodes.BAD_REQUEST });
      }

      req.context.users = users;
      return next();
    },

  },

  one: {

    find: async (req, res, next) => {
      const db = req.app.locals.database.SmartHome;
      let user = null;
      try {
        user = await db.collection('users').findOne({
          $or: [
            { username: req.params.username },
            { _id: ObjectID.isValid(req.params.username) ? ObjectID(req.params.username) : undefined }
          ]
        });

        if (!user) {
          throw new Error('user not found');
        }
      } catch (e) {
        log(e);
        return res
          .status(StatusCodes.NOT_FOUND)
          .json({ message: StatusCodes.getStatusText(StatusCodes.NOT_FOUND), status: StatusCodes.NOT_FOUND });
      }

      req.context.user = user;
      return next();
    },

  },

  delete: {

    delete: async (req, res, next) => {
      const db   = req.app.locals.database.SmartHome;
      let result = null;
      try {
        result = await db.collection('users').deleteOne({
          $or: [
            { username: req.params.username },
            { _id: ObjectID.isValid(req.params.username) ? ObjectID(req.params.username) : undefined }
          ]
        });

        if (!result.deletedCount) {
          log(`user ${req.params.username} not found`);
          return res
            .status(StatusCodes.NOT_FOUND)
            .json({ message: StatusCodes.getStatusText(StatusCodes.NOT_FOUND), status: StatusCodes.NOT_FOUND });
        }
      } catch (e) {
        log(e);
        return res
          .status(StatusCodes.NOT_FOUND)
          .json({ message: StatusCodes.getStatusText(StatusCodes.NOT_FOUND), status: StatusCodes.NOT_FOUND });
      }

      return next();
    },

  }

};


Router.post(
  '/',
  middleware.create.validate,
  middleware.create.ensureUnique,
  middleware.create.insert,
  (req, res) => {
    const user     = _.get(req, 'context.user');
    const username = _.get(user, 'username');
    const userId   = _.get(user, '_id');
    log(`inserted user ${username} into the database`);

    res.header('Location', `/users/${userId}`);
    return res.json({
      status: StatusCodes.OK,
      user
    });
  }
);

Router.get(
  '/',
  middleware.list.find,
  (req, res) => {
    log('retrieved users');
    return res.json({
      status: StatusCodes.OK,
      users:  _.get(req, 'context.users', [])
    });
  }
);

Router.get(
  '/:username',
  middleware.one.find,
  (req, res) => {
    log('retrieved user');
    return res.json({
      status: StatusCodes.OK,
      user:   _.get(req, 'context.user')
    });
  }
);

Router.delete(
  '/:username',
  middleware.delete.delete,
  (req, res) => {
    log('deleted user');
    return res.json({
      status: StatusCodes.OK,
    });
  }
);

module.exports = Router;
