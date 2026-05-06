/**
 * Transaction Routes — Main Router
 * 
 * This file aggregates all transaction sub-modules:
 * - transactionQueries  : GET routes (list, asset-units, jobRequests, logistics/jobs, next-txn-no)
 * - transactionBatch    : POST /processBatch (issue, return, fulfill, transfer, survey)
 * - transactionJobs     : POST /cancel, /jobRequest, /logistics/rider-cancel
 * - transactionReview   : POST /confirm-repair, /wipe-queues
 */
import { Router } from 'express';
import queryRoutes from './transactionQueries';
import batchRoutes from './transactionBatch';
import jobRoutes from './transactionJobs';
import reviewRoutes from './transactionReview';

const router = Router();

// Mount all sub-routers on the same base path
router.use('/', queryRoutes);
router.use('/', batchRoutes);
router.use('/', jobRoutes);
router.use('/', reviewRoutes);

export default router;
