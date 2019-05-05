const Express     = require('express');
const Router      = Express.Router();
const StatusCodes = require('http-status-codes');
const _           = require('lodash');
const log         = require('debug')('app:routes:devices');
const ObjectID    = require('mongodb').ObjectID;


const middleware = {

  create: {

    /**
     * Ensure new device is valid
     */
    validate: async (req, res, next) => {
      const validator         = req.app.locals.validator;
      const [ valid, errors ] = await validator.validate('device_create', req.body);

      if (!valid) {
        log(valid, errors);
        return res.status(StatusCodes.BAD_REQUEST)
                  .json({
                    status:  StatusCodes.BAD_REQUEST,
                    message: StatusCodes.getStatusText(StatusCodes.BAD_REQUEST)
                  });
      }

      req.context.device = { ...req.body };
      return next();
    },


    /**
     * Ensure device is unique in the database
     */
    ensureUnique: async (req, res, next) => {
      const { chipId } = req.context.device;

      try {
        const db   = req.app.locals.database.SmartHome;
        const device = await db.collection('devices')
                             .findOne({ chipId });

        if (device) {
          log(`device ${chipId} already exists`);
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
     * Save the device in the database
     */
    insert: async (req, res, next) => {
      const device        = req.context.device;
      device.createdAt    = Date.now();
      device.lastModified = Date.now();

      const db = req.app.locals.database.SmartHome;
      try {
        await db.collection('devices').insertOne(device);
      } catch (e) {
        log(e);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR)
                  .json({
                    message: StatusCodes.getStatusText(StatusCodes.INTERNAL_SERVER_ERROR),
                    status:  StatusCodes.INTERNAL_SERVER_ERROR
                  });
      }

      //eq.context.device = _.omit(device, [ 'chipId', '__version' ]);
      return next();
    },

  },

  list: {

    find: async (req, res, next) => {
      const db  = req.app.locals.database.SmartHome;
      let devices = [];
      try {
        devices = await db.collection('devices')
                        .find()
                        .project({ _id: 1, chipId: 1 })
                        .toArray();
      } catch (e) {
        log(e);
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: StatusCodes.getStatusText(StatusCodes.BAD_REQUEST), status: StatusCodes.BAD_REQUEST });
      }

      req.context.devices = devices;
      return next();
    },

  },

  one: {

    find: async (req, res, next) => {
      const db = req.app.locals.database.SmartHome;
      let device = null;
      try {
        device = await db.collection('devices').findOne({
          $or: [
            { chipId: req.params.chipId },
            { _id: ObjectID.isValid(req.params.chipId) ? ObjectID(req.params.chipId) : undefined }
          ]
        });
      } catch (e) {
        log(e);
        return res
          .status(StatusCodes.NOT_FOUND)
          .json({ message: StatusCodes.getStatusText(StatusCodes.NOT_FOUND), status: StatusCodes.NOT_FOUND });
      }

      req.context.device = device;
      return next();
    },

  },

  delete: {

    delete: async (req, res, next) => {
      const db   = req.app.locals.database.SmartHome;
      let result = null;
      try {
        result = await db.collection('devices').deleteOne({
          $or: [
            { chipId: req.params.chipId },
            { _id: ObjectID.isValid(req.params.chipId) ? ObjectID(req.params.chipId) : undefined }
          ]
        });

        if (!result.deletedCount) {
          log(`device ${req.params.chipId} not found`);
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
    log(`inserted device ${_.get(req, 'context.device.chipId')} into the database`);
    return res.json({
      status: StatusCodes.OK,
      device:   _.get(req, 'context.device')
    });
  }
);

Router.get(
  '/',
  middleware.list.find,
  (req, res) => {
    log('retrieved devices');
    return res.json({
      status: StatusCodes.OK,
      devices:  _.get(req, 'context.devices', [])
    });
  }
);

Router.get(
  '/:chipId',
  middleware.one.find,
  (req, res) => {
    log('retrieved device');
    return res.json({
      status: StatusCodes.OK,
      device:   _.get(req, 'context.device')
    });
  }
);

Router.delete(
  '/:chipId',
  middleware.delete.delete,
  (req, res) => {
    log('deleted device');
    return res.json({
      status: StatusCodes.OK,
    });
  }
);

module.exports = Router;