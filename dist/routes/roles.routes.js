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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const roleHierarchy_1 = require("../utils/roleHierarchy");
const router = (0, express_1.Router)();
//return equal or below roles
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const role = req.user.role;
    const rolesEqualOrBelow = (0, roleHierarchy_1.getRolesEqualOrBelow)(role);
    const rolesWithId = rolesEqualOrBelow.map((role) => ({ id: role, name: role }));
    res.status(200).json(rolesWithId);
}));
exports.default = router;
