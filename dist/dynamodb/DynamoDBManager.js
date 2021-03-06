"use strict";
/*
 * Copyright 2010-2013 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var S2Manager_1 = require("../s2/S2Manager");
var DynamoDBManager = /** @class */ (function () {
    function DynamoDBManager(config) {
        this.config = config;
    }
    /**
     * Query Amazon DynamoDB
     *
     * @param queryInput
     * @param hashKey
     *            Hash key for the query request.
     *
     * @param range
     *            The range of geohashs to query.
     *
     * @return The query result.
     */
    DynamoDBManager.prototype.queryGeohash = function (queryInput, hashKey, range) {
        var _this = this;
        var queryOutputs = [];
        var nextQuery = function (lastEvaluatedKey) {
            if (lastEvaluatedKey === void 0) { lastEvaluatedKey = null; }
            var keyConditions = {};
            keyConditions[_this.config.hashKeyAttributeName] = {
                ComparisonOperator: "EQ",
                AttributeValueList: [{ N: hashKey.toString(10) }]
            };
            var minRange = { N: range.rangeMin.toString(10) };
            var maxRange = { N: range.rangeMax.toString(10) };
            keyConditions[_this.config.geohashAttributeName] = {
                ComparisonOperator: "BETWEEN",
                AttributeValueList: [minRange, maxRange]
            };
            var defaults = {
                TableName: _this.config.tableName,
                KeyConditions: keyConditions,
                IndexName: _this.config.geohashIndexName,
                ConsistentRead: _this.config.consistentRead,
                ReturnConsumedCapacity: "TOTAL",
                ExclusiveStartKey: lastEvaluatedKey
            };
            return _this.config.dynamoDBClient.query(__assign({}, defaults, queryInput)).promise()
                .then(function (queryOutput) {
                queryOutputs.push(queryOutput);
                if (queryOutput.LastEvaluatedKey) {
                    return nextQuery(queryOutput.LastEvaluatedKey);
                }
            });
        };
        return nextQuery().then(function () { return queryOutputs; });
    };
    DynamoDBManager.prototype.getPoint = function (getPointInput) {
        var _a;
        var geohash = S2Manager_1.S2Manager.generateGeohash(getPointInput.GeoPoint);
        var hashKey = S2Manager_1.S2Manager.generateHashKey(geohash, this.config.hashKeyLength);
        var getItemInput = getPointInput.GetItemInput;
        getItemInput.TableName = this.config.tableName;
        getItemInput.Key = (_a = {},
            _a[this.config.hashKeyAttributeName] = { N: hashKey.toString(10) },
            _a[this.config.rangeKeyAttributeName] = getPointInput.RangeKeyValue,
            _a);
        return this.config.dynamoDBClient.getItem(getItemInput);
    };
    DynamoDBManager.prototype.putPoint = function (putPointInput) {
        var geohash = S2Manager_1.S2Manager.generateGeohash(putPointInput.GeoPoint);
        var hashKey = S2Manager_1.S2Manager.generateHashKey(geohash, this.config.hashKeyLength);
        var putItemInput = __assign({}, putPointInput.PutItemInput, { TableName: this.config.tableName, Item: putPointInput.PutItemInput.Item || {} });
        putItemInput.Item[this.config.hashKeyAttributeName] = { N: hashKey.toString(10) };
        putItemInput.Item[this.config.rangeKeyAttributeName] = putPointInput.RangeKeyValue;
        putItemInput.Item[this.config.geohashAttributeName] = { N: geohash.toString(10) };
        putItemInput.Item[this.config.geoJsonAttributeName] = {
            S: JSON.stringify({
                type: 'POINT',
                coordinates: (this.config.longitudeFirst ?
                    [putPointInput.GeoPoint.longitude, putPointInput.GeoPoint.latitude] :
                    [putPointInput.GeoPoint.latitude, putPointInput.GeoPoint.longitude])
            })
        };
        return this.config.dynamoDBClient.putItem(putItemInput);
    };
    DynamoDBManager.prototype.batchWritePoints = function (putPointInputs) {
        var _a;
        var _this = this;
        var writeInputs = [];
        putPointInputs.forEach(function (putPointInput) {
            var geohash = S2Manager_1.S2Manager.generateGeohash(putPointInput.GeoPoint);
            var hashKey = S2Manager_1.S2Manager.generateHashKey(geohash, _this.config.hashKeyLength);
            var putItemInput = putPointInput.PutItemInput;
            var putRequest = {
                Item: putItemInput.Item || {}
            };
            putRequest.Item[_this.config.hashKeyAttributeName] = { N: hashKey.toString(10) };
            putRequest.Item[_this.config.rangeKeyAttributeName] = putPointInput.RangeKeyValue;
            putRequest.Item[_this.config.geohashAttributeName] = { N: geohash.toString(10) };
            putRequest.Item[_this.config.geoJsonAttributeName] = {
                S: JSON.stringify({
                    type: 'POINT',
                    coordinates: (_this.config.longitudeFirst ?
                        [putPointInput.GeoPoint.longitude, putPointInput.GeoPoint.latitude] :
                        [putPointInput.GeoPoint.latitude, putPointInput.GeoPoint.longitude])
                })
            };
            writeInputs.push({ PutRequest: putRequest });
        });
        return this.config.dynamoDBClient.batchWriteItem({
            RequestItems: (_a = {},
                _a[this.config.tableName] = writeInputs,
                _a)
        });
    };
    DynamoDBManager.prototype.updatePoint = function (updatePointInput) {
        var geohash = S2Manager_1.S2Manager.generateGeohash(updatePointInput.GeoPoint);
        var hashKey = S2Manager_1.S2Manager.generateHashKey(geohash, this.config.hashKeyLength);
        updatePointInput.UpdateItemInput.TableName = this.config.tableName;
        var updateAttributesOnly = false;
        if (!updatePointInput.UpdateItemInput.Key) {
            updatePointInput.UpdateItemInput.Key = {};
            updatePointInput.UpdateItemInput.Key[this.config.hashKeyAttributeName] = { N: hashKey.toString(10) };
            updatePointInput.UpdateItemInput.Key[this.config.rangeKeyAttributeName] = updatePointInput.RangeKeyValue;
        }
        else {
            updateAttributesOnly = true;
            updatePointInput.UpdateItemInput.AttributeUpdates[this.config.hashKeyAttributeName] = { N: hashKey.toString(10) };
        }
        // Geohash and geoJson cannot be updated.
        if (updatePointInput.UpdateItemInput.AttributeUpdates && !updateAttributesOnly) {
            delete updatePointInput.UpdateItemInput.AttributeUpdates[this.config.geohashAttributeName];
            delete updatePointInput.UpdateItemInput.AttributeUpdates[this.config.geoJsonAttributeName];
        }
        return this.config.dynamoDBClient.updateItem(updatePointInput.UpdateItemInput);
    };
    DynamoDBManager.prototype.deletePoint = function (deletePointInput) {
        var _a;
        var geohash = S2Manager_1.S2Manager.generateGeohash(deletePointInput.GeoPoint);
        var hashKey = S2Manager_1.S2Manager.generateHashKey(geohash, this.config.hashKeyLength);
        return this.config.dynamoDBClient.deleteItem(__assign({}, deletePointInput.DeleteItemInput, { TableName: this.config.tableName, Key: (_a = {},
                _a[this.config.hashKeyAttributeName] = { N: hashKey.toString(10) },
                _a[this.config.rangeKeyAttributeName] = deletePointInput.RangeKeyValue,
                _a) }));
    };
    return DynamoDBManager;
}());
exports.DynamoDBManager = DynamoDBManager;
