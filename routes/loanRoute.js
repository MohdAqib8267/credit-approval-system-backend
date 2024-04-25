import express from "express";
import { getLoanDetails, loanEligibilty, makePayment } from "../controllers/loanController.js";

const router = express.Router();

router.post('/eligibility',loanEligibilty);
router.post('/create-loan',loanEligibilty);
router.get('/view-loan/:loan_id',getLoanDetails);
router.get('/view-statement/:customer_id/:loan_id',getLoanDetails);
router.post('/make-payment/:customer_id/:loan_id',makePayment);

export {router as loanRoute};