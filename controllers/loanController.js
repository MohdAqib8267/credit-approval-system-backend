import asyncHandler from "express-async-handler";

import {prisma} from "../config/prismaConfig.js";

// endpoint for check loan eliibility
export const loanEligibilty = asyncHandler(async(req,res)=>{
    const {customer_id,loan_amount,interest_rate,tenure}=req.body;
    const url = req.url;

    console.log(url);
    try {
        if (!customer_id || !loan_amount || !interest_rate || !tenure) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        //calculate placeholder

        const customer = await prisma.$queryRaw`
        SELECT c.customer_id, c.first_name, c.last_name, c.age, c.phone_number, c.monthly_salary, c.approved_limit, c.current_debt,
        l.loan_id, l.loan_amount, l.tenure, l.interest_rate, l.emi, l.EMIs_paid_on_time, l.date_of_approval, l.end_Date
        FROM Customer As c
        LEFT JOIN Loan As l ON c.customer_id = l.customer_id
        WHERE c.customer_id = ${customer_id}
        `;

        // res.json(customer);
        const creditScore = await calculateCreditScore(customer);
        // res.json(creditScore);
        let approved=false;
        let correctedInterestRate = interest_rate;

        if(creditScore > 50){
            approved = true;
        }
        else if(creditScore < 50 && creditScore > 30){
            if (interest_rate <= 12) {
                correctedInterestRate = 12;
            }
            approved = true;
        }
        else if(creditScore < 30 && creditScore > 10){
            if (interest_rate <= 16) {
                correctedInterestRate = 16;
            }
            approved = true;
        }
       
        // Check if sum of all current EMIs > 50% of monthly salary
        const totalEMI = await calculateTotalEMI(customer);
        const monthlySalary = customer.monthly_salary;
        
        if(totalEMI > monthlySalary*0.5){
            approved = false;
        }

        // //calculate monthly installment
        const monthly_installment = await getMonthlyInstallment(loan_amount, correctedInterestRate, tenure);
        // res.json(monthly_installment);
        const response = {
            customer_id,
            approved,
            interest_rate,
            corrected_interest_rate: correctedInterestRate,
            tenure,
            monthly_installment
        };
        if(url == '/eligibility'){
           return res.status(200).json(response);
        }
       
        
        if (approved) {
            //if url is "/create-loan" then create loan based on eligibility
        const newLoan = await prisma.$queryRaw`
            INSERT INTO Loan (customer_id,loan_amount,tenure,interest_rate,emi,EMIs_paid_on_time,date_of_approval,end_Date)
            VALUES
            (${customer_id},${loan_amount},${tenure},${interest_rate},${monthly_installment},0,"24-0-2024","24-03-2027")
            `
        ;
        
        
        const myCust = await prisma.$queryRaw` select current_debt from Customer WHERE customer_id=${customer_id}`;
        
        const newDebt = (myCust[0]?.current_debt + loan_amount) || 0;
        ;
        // Update customer's current debt
            await prisma.$executeRaw`
            UPDATE Customer
            SET current_debt = ${newDebt}
            WHERE customer_id = ${customer_id}
            `;

            return res.status(201).json({
                message: 'Loan Added Successfully',
                customer_id: customer_id,
                loan_approved: approved,
                monthly_installment: monthly_installment
            });
        } else {
            return res.status(403).json({
                message: 'Loan not approved',
                customer_id: customer_id,
                loan_approved: approved
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
})

const calculateCreditScore=async(customer)=> {

    if (!customer) {
        throw new Error('Customer not found');
    }

    // Initialize credit score
    let creditScore = 100; 

    //1: Past Loans paid on time
    const totalLoans = customer.length;
    
   
    let sumPercentageLoansPaidOnTime = 0;
    // Calculate percentage of EMIs paid on time for each loan and sum them up
    customer.forEach((loan) => {
        const percentageLoansPaidOnTime = (loan.EMIs_paid_on_time / loan.tenure) * 100;
        sumPercentageLoansPaidOnTime += percentageLoansPaidOnTime;
    });
    const avgOfLoanPaidOnTime = Math.round(sumPercentageLoansPaidOnTime / totalLoans);
    // console.log(avgOfLoanPaidOnTime);
    const currentYear = new Date().getFullYear();
    const loansInCurrentYear = customer.filter(loan => new Date(loan.date_of_approval).getFullYear() === currentYear);

    // Adjust credit score based on past loans paid on time
    if (totalLoans<=3 && avgOfLoanPaidOnTime > 70 && loansInCurrentYear>3 ) {
        creditScore -= 20; 
    }
    else if(totalLoans>3 && avgOfLoanPaidOnTime>50 && loansInCurrentYear>2){
        creditScore -= 40;
    }
    else if(avgOfLoanPaidOnTime>30 && loansInCurrentYear>=0){
        creditScore -=60;
    }
    
    // Component 5: Sum of current loans > approved limit
    const sumCurrentLoans = customer.reduce((acc, loan) => acc + loan.loan_amount, 0);

    if (sumCurrentLoans > customer.approved_limit) {
        creditScore = 0; 
    }
    // console.log(creditScore);
    return creditScore;

}

const calculateTotalEMI = async (customer) => {
    
    

    if (!customer) {
        throw new Error('Customer not found');
    }
    
    let totalEMI = 0;
    customer.forEach((loan) => {
        totalEMI += loan.emi;
    });

    return totalEMI;
};



async function getMonthlyInstallment(loanAmount, interestRate, tenure) {
    
    // Formula: P*r*(1 + r)^n / ((1 + r)^n - 1)
    const r = interestRate / 1200; // Monthly interest rate
    const n = tenure * 12; // Total number of payments
    const monthlyInstallment = loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    return monthlyInstallment.toFixed(2); 
}


//view loans details and view statement
export const getLoanDetails = asyncHandler(async(req,res)=>{
    const {customer_id,loan_id} = req.params;
    // console.log(req.url);
    const url = req.url.split('/')[1]; // Split by '/' and get the first part
console.log(url);
    // console.log(loan_id);
    try {
        const loanDetails = await prisma.$queryRaw`
            SELECT * FROM Loan As l
            INNER JOIN Customer As c
            ON l.customer_id = c.customer_id
            WHERE loan_id=${loan_id}
        `;
        if(loanDetails.length == 0){
            return res.json(400).json({
                message:'Loan Not Found'
            })
        }
        const responseForViewLoan = {
            customer:{
                customer_id:loanDetails[0]?.customer_id,
                first_name:loanDetails[0]?.first_name,
                last_name:loanDetails[0]?.last_name,
                phone_number:loanDetails[0]?.phone_number,
                age:loanDetails[0]?.age
            },
            loan_id:loanDetails[0]?.loan_id,
            loan_amount:loanDetails[0]?.loan_amount,
            interest_rate:loanDetails[0]?.interest_rate,
            monthly_installment:loanDetails[0]?.emi,
            tenure:loanDetails[0]?.tenure
        }
        if(url=='view-loan'){
            return res.status(200).json(responseForViewLoan);
        }
        const respoceForViewStatement={
            customer_id:loanDetails[0]?.customer_id,
            loan_id:loanDetails[0]?.loan_id,
            principal:loanDetails[0]?.loan_amount,
            interest_rate:loanDetails[0]?.interest_rate,
            Amount_paid: loanDetails[0]?.amount_pay,
            monthly_installment:loanDetails[0]?.emi,
            repayments_left:loanDetails[0]?.tenure - loanDetails[0]?.EMIs_paid_on_time
        }
        if(url=='view-statement'){
            return res.status(200).json(respoceForViewStatement);
        }
        else{
            return res.status(404).json('Url not found');
        }
    } catch (error) {
        console.log(error);
        res.status(500).json('Internal server error');
    }
})

// make payment towards an EMI
export const makePayment = asyncHandler(async (req, res) => {
    const { customer_id, loan_id } = req.params;
    let { amount } = req.body;
  
    try {
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
  
      // Fetch loan details
      const loanDetails = await prisma.$queryRaw`
            SELECT * FROM Loan As l
            INNER JOIN Customer As c
            ON l.customer_id = c.customer_id
            WHERE loan_id=${loan_id}
      `;
  
      if (!loanDetails || !loanDetails.length) {
        return res.status(404).json({ message: 'Loan not found' });
      }
  
      const loan = loanDetails[0];
    //   console.log(loan);
     
      // Calculate remaining loan amount
      //check loan amount has already payed?
      if(loan.loan_amount - loan.amount_pay<=0){
        return res.status().json({message:'Your Loan amount had payed'})
      }

      //deduct only reasonable price
      if(loan.loan_amount - loan.amount_pay<amount){
        amount = loan.loan_amount - loan.amount_pay; 
      }
      const totalPayableAmount = loan.amount_pay+amount
      const remainingLoanAmount = loan.loan_amount - (totalPayableAmount);

      
      // Calculate new EMI
      const newEMI = await getMonthlyInstallment(remainingLoanAmount, loan.interest_rate, loan.tenure);
  
      // Update loan details
      const data=await prisma.$executeRaw`
        UPDATE Loan
        SET emi = ${newEMI}, amount_pay=${totalPayableAmount}, EMIs_paid_on_time = ${loan.EMIs_paid_on_time + 1}
        WHERE loan_id = ${loan_id}
      `;
  
      // Update customer's current debt
      await prisma.$executeRaw`
        UPDATE Customer
        SET current_debt = ${loan.current_debt} - ${amount}
        WHERE customer_id = ${loan.customer_id}
      `;
  
      res.status(200).json({ message: 'Payment made successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json('Internal server error');
    }
  });
  