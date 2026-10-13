export type ShippingOption = {
  id: string;
  name: string;
  price: number;
  deliveryEstimate: string;
  carrierPrice?: number;
};
