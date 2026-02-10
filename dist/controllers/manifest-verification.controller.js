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
exports.manifestVerification = void 0;
const manifest_verification_repository_1 = __importDefault(require("../repositories/manifest-verification.repository"));
exports.manifestVerification = {
    /**
     * Get all verifications with pagination and filters
     */
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const status = req.query.status;
        const container_id = req.query.container_id ? Number(req.query.container_id) : undefined;
        const flight_id = req.query.flight_id ? Number(req.query.flight_id) : undefined;
        const result = yield manifest_verification_repository_1.default.getAll(page, limit, status, container_id, flight_id);
        res.status(200).json({
            rows: result.verifications,
            total: result.total,
            page,
            limit,
        });
    }),
    /**
     * Get verification by ID
     */
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const verification = yield manifest_verification_repository_1.default.getById(id);
        if (!verification) {
            res.status(404).json({ error: "Verification not found" });
            return;
        }
        res.status(200).json(verification);
    }),
    /**
     * Start container verification
     */
    startContainerVerification: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { container_id } = req.body;
        const user = req.user;
        const verification = yield manifest_verification_repository_1.default.startContainerVerification(container_id, user.id);
        res.status(201).json(verification);
    }),
    /**
     * Start flight verification
     */
    startFlightVerification: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { flight_id } = req.body;
        const user = req.user;
        const verification = yield manifest_verification_repository_1.default.startFlightVerification(flight_id, user.id);
        res.status(201).json(verification);
    }),
    /**
     * Scan parcel for verification
     */
    scanParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { tracking_number } = req.body;
        const user = req.user;
        const result = yield manifest_verification_repository_1.default.scanParcel(id, tracking_number, user.id);
        res.status(200).json(result);
    }),
    /**
     * Complete verification
     */
    complete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { notes } = req.body;
        const user = req.user;
        const verification = yield manifest_verification_repository_1.default.complete(id, user.id, notes);
        res.status(200).json(verification);
    }),
    /**
     * Report damaged parcel
     */
    reportDamage: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { tracking_number, notes } = req.body;
        const user = req.user;
        const discrepancy = yield manifest_verification_repository_1.default.reportDamage(id, tracking_number, user.id, notes);
        res.status(201).json(discrepancy);
    }),
    /**
     * Resolve discrepancy
     */
    resolveDiscrepancy: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { discrepancyId } = req.params;
        const { resolution } = req.body;
        const user = req.user;
        const discrepancy = yield manifest_verification_repository_1.default.resolveDiscrepancy(discrepancyId, resolution, user.id);
        res.status(200).json(discrepancy);
    }),
    /**
     * Get discrepancies for a verification
     */
    getDiscrepancies: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const discrepancies = yield manifest_verification_repository_1.default.getDiscrepancies(id);
        res.status(200).json(discrepancies);
    }),
};
exports.default = exports.manifestVerification;
