export function calculateTotals(lines: { priceFils: number; quantity: number }[], percentOff = 0) {
  const subtotalFils = lines.reduce((sum, line) => sum + line.priceFils * line.quantity, 0);
  const discountFils = Math.floor(subtotalFils * percentOff / 100);
  const deliveryFils = subtotalFils - discountFils >= 50000 ? 0 : 3000;
  return { subtotalFils, discountFils, deliveryFils, totalFils: subtotalFils - discountFils + deliveryFils };
}
