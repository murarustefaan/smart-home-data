const express         = require('express');
const async           = require('async');
const Config          = require('./controllers/config');
const MongoConnection = require('./controllers/data');
const Validator       = require('./controllers/validation');
const log             = require('debug')('app:index');


const app = express();

/**
 * Async app initializer
 */
(async () => {

  const apiPort = Config.getConfig('api.port');

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const dependencies = await initDependencies();
  if (!dependencies) {
    return process.exit(1);
  }

  // use app locals to share dependencies with route handlers
  app.locals = {
    ...app.locals,
    ...dependencies,
  };

  // ensure context on reqs
  app.use((req, res, next) => {
    req.context = {};
    next();
  });
  app.use('/health', require('./routes/health'));
  app.use('/users', require('./routes/users'));


  app.listen(
    apiPort,
    (err) => {
      if (err) {
        log(`error starting the server: ${err}`);
      } else {
        log(`api started on port ${apiPort}`);
      }
    }
  );

})();

function initDependencies() {
  return new Promise((resolve, _reject) => {
    async.auto({
      // initialize database connections
      database:  async () => {
        const client                = new MongoConnection(Config.getDatabaseConnectionString());
        const connectedSuccessfully = await client.connect();
        return connectedSuccessfully ? client : null;
      },
      validator: async () => new Validator().init()
    }, (error, results) => {
      if (error) {
        log(`an error occured: ${error}`);
        log('exiting process');
        return resolve(null);
      }

      log('init done');
      resolve(results);
    });
  });
}