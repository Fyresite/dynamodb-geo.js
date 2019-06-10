import { GeoPoint } from "../types";
import * as Long from "long";
export declare class S2Manager {
    static generateGeohash(geoPoint: GeoPoint): any;
    static generateHashKey(geohash: Long, hashKeyLength: number): any;
}
