const Express = require('express');
const Router  = Express.Router();

const Status = {
  OK:    'ok',
  ERROR: 'error',
};


Router.get(
  '/',
  (req, res) => res.json({
    api:      Status.OK,
    database: req.app.locals.database ? Status.OK : Status.ERROR,
  })
);


module.exports = Router;
