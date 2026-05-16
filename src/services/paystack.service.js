import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { Payment } from '../models/Payment.js';

const BASE = 'https://api.paystack.co';

function headers() {
  return {
    Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function initializeTransaction({ email, amountKobo, reference, metadata, callback_url }) {
  const body = {
    email,
    amount: amountKobo,
    reference,
    metadata,
  };
  if (callback_url) body.callback_url = callback_url;
  const { data } = await axios.post(`${BASE}/transaction/initialize`, body, { headers: headers() });
  if (!data?.status) {
    throw Object.assign(new Error(data?.message || 'Paystack initialize failed'), { status: 502 });
  }
  return data.data;
}

export async function verifyTransaction(reference) {
  const { data } = await axios.get(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: headers(),
  });
  if (!data?.status) {
    throw Object.assign(new Error(data?.message || 'Paystack verify failed'), { status: 502 });
  }
  return data.data;
}

export function verifyPaystackSignature(rawBody, signature) {
  if (!env.PAYSTACK_WEBHOOK_SECRET) return false;
  const hash = crypto.createHmac('sha512', env.PAYSTACK_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return hash === signature;
}

export async function recordPendingPayment(doc) {
  return Payment.create(doc);
}

export async function updatePaymentByReference(reference, patch) {
  return Payment.findOneAndUpdate({ reference }, { $set: patch }, { new: true });
}
