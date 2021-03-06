const Ajv = require('ajv');
const log = require('debug')('app:controllers:validation');


module.exports = class Validator {

  constructor() {
    /**
     * @private
     * @type {ajv | ajv.Ajv}
     */
    this.validator = new Ajv();

    /**
     * @private
     */
    this.validationSchemas = {
      user_create:  '../validation/users/user_create.json',
    };
  }


  /**
   * Compile all endpoints validation schemas
   * TODO: maybe compileAsync?
   */
  init() {
    this.validationSchemas = Object.entries(this.validationSchemas)
                          .map(([ route, schemaPath ]) => ([ route, require(schemaPath) ]))
                          .map(([ route, schema ]) => ([route, this.validator.compile(schema)]))
                          .reduce((acc, [ route, compiledSchema ]) => {
                            acc[route] = compiledSchema;
                            return acc;
                          }, {});

    return this;
  }


  async validate(schema, data) {
    try {
      const validationFunction = this.validationSchemas[schema];
      const valid = await validationFunction(data);
      return [valid, validationFunction.errors];
    }
    catch(e) {
      log(e);
      return false;
    }
  }

};
