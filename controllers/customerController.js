import asyncHandler from "express-async-handler";

import {prisma} from "../config/prismaConfig.js";

export const customerRegister = asyncHandler(async (req, res) => {
    const { first_name, last_name, age, phone_number, monthly_salary } = req.body;

    try {
        if (!first_name || !last_name || !age || !monthly_salary || !phone_number) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check if customer already exists
        const customerExist = await prisma.$queryRaw `
            SELECT * FROM Customer WHERE phone_number = ${phone_number}
        `;

        if (customerExist.length > 0) {
            return res.status(409).json({ message: 'Customer already exists!' });
        }

        // Calculate approved limit
        const approvedLimit = Math.round(36 * monthly_salary / 100000) * 100000;

        // Create customer
        const customer = await prisma.$queryRaw `
        INSERT INTO Customer (first_name, last_name, age, phone_number, monthly_salary, approved_limit)
        VALUES 
        (${first_name}, ${last_name}, ${age}, ${phone_number}, ${monthly_salary}, ${approvedLimit}) 
    `;

     return res.status(201).json('User add Successfully');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

