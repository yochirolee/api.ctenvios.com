"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.legacy_db_service = exports.legacyMysqlDb = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const legacyMysqlDb = () => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield promise_1.default.createConnection({
        host: "auth-db1444.hstgr.io",
        user: "u373067935_caeenvio_mysgc",
        password: "CaribeAgencia*2022",
        database: "u373067935_cte",
    });
    return db;
});
exports.legacyMysqlDb = legacyMysqlDb;
exports.legacy_db_service = {
    getParcelsByOrderId: (orderId) => __awaiter(void 0, void 0, void 0, function* () {
        const db = yield (0, exports.legacyMysqlDb)();
        const [rows] = yield db.execute("SELECT * FROM parcels WHERE id = ?", [orderId]);
        return rows;
    }),
};
