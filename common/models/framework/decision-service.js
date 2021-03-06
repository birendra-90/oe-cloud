/**
 *
 * ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

// var XLSX = require('xlsx');
var feel = require('js-feel');
// var DL = feel.decisionLogic;
var DS = feel.decisionService;

var logger = require('oe-logger');
var log = logger('decision-service');
var util = require('util');

module.exports = function (DecisionService) {
  DecisionService.observe('before save', function (ctx, next) {
    var dataObj = ctx.instance || ctx.data;
    var decisions = dataObj.decisions;

    dataObj['decision-graph'](ctx.options, function (err, result) {
      if (err) {
        next(err);
      } else {
        // var keys = result.data;
        // eslint-disable-next-line
        if (decisions.every(p => p in result.data)) {
          next();
        } else {
          var idx = decisions.findIndex(d => !(d in result.data));
          var item = decisions[idx];
          var errStr = util.format('Decision %s does not belong to the decision graph: %s', item, result.name);
          log.error(errStr);
          next(new Error(errStr));
        }
      }
    });
  });

  DecisionService.remoteMethod('invoke', {
    description: 'Invoke service with name and payload',
    accepts: [
      {
        arg: 'name',
        type: 'string',
        http: {
          source: 'path'
        },
        required: true,
        description: 'name of the service'
      },
      {
        arg: 'payload',
        type: 'object',
        description: 'the payload for this decision service',
        http: {
          source: 'body'
        },
        required: true
      }
    ],
    returns: {
      arg: 'response',
      type: 'object',
      root: true
    },
    http: {
      verb: 'POST',
      path: '/invoke/:name'
    }
  });

  DecisionService.invoke = function DecisionServiceInvoke(name, payload, options, cb) {
    DecisionService.findOne({ where: { name: name } }, options, (err, result) => {
      if (err) {
        cb(err);
      } else {
        var decisions = result.decisions;
        result['decision-graph'](options, (err, graph) => {
          if (err) {
            cb(err);
          } else {
            var decisionMap = graph.data;
            var ast = DS.createDecisionGraphAST(decisionMap);
            var promises = decisions.map(d => DS.executeDecisionService(ast, d, payload));
            Promise.all(promises).then(answers => {
              var final = answers.reduce((hash, answer) => {
                return Object.assign({}, hash, answer);
              }, {});

              cb(null, final);
            })
              .catch(err => {
                cb(err);
              });
          }
        });
      }
    });
  };
};
