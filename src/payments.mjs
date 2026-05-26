import { getPackageById } from './core.mjs';

export function buildOrder({ customerEmail, packageId }) {
  const plan = getPackageById(packageId);
  return {
    id: `ORD-${Date.now().toString(36).toUpperCase()}`,
    customerEmail,
    packageId: plan.id,
    packageName: plan.name,
    amount: plan.price,
    currency: plan.currency,
    status: 'Pending',
    provider: 'simulated',
    checkoutUrl: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
  };
}

export function createSimulatedCheckoutProvider() {
  return {
    mode: 'simulated',
    async checkout(order) {
      return {
        ...order,
        status: 'Paid',
        provider: 'simulated',
        checkoutUrl: `simulated://checkout/${order.id}`,
        paidAt: new Date().toISOString(),
      };
    },
  };
}

export function resolveCheckoutMode(config) {
  return config?.stripePublishableKey ? 'stripe' : 'simulated';
}

export function createCheckoutProvider(config) {
  if (resolveCheckoutMode(config) === 'simulated') {
    return createSimulatedCheckoutProvider();
  }

  return {
    mode: 'stripe',
    async checkout() {
      throw new Error('Stripe checkout is not connected yet. Use simulated checkout until Stripe keys are configured server-side.');
    },
  };
}
