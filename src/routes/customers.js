'use strict';

const router = require('express').Router();
const { listCustomers, getCustomer } = require('../controllers/customersController');

// GET /customers
router.get('/', listCustomers);

// GET /customers/:id
router.get('/:id', getCustomer);

module.exports = router;
