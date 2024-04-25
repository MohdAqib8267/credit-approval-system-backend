import express from "express";
import { customerRegister } from "../controllers/customerController.js";

const router = express.Router();


router.post('/register',customerRegister);

export {router as customerRoute}