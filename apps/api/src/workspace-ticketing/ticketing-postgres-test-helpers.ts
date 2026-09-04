let ticketNumberCounter = 0;

export function nextPostgresTestTicketNumber(): number {
  ticketNumberCounter += 1;
  return ticketNumberCounter;
}

export function resetPostgresTestTicketNumbers(): void {
  ticketNumberCounter = 0;
}
