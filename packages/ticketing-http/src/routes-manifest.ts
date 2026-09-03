export const TICKETING_HTTP_ROUTE_MANIFEST = {
  static: [
    { method: "GET", path: "/member/tickets", handler: "handleTicketingMemberListTickets" },
    { method: "POST", path: "/member/tickets", handler: "handleTicketingMemberCreateTicket" },
    { method: "GET", path: "/tickets", handler: "handleTicketingOperatorListTickets" },
  ],
  param: [
    { method: "GET", path: "/member/tickets/:ticketId", handler: "handleTicketingMemberGetTicket" },
    {
      method: "POST",
      path: "/member/tickets/:ticketId/messages",
      handler: "handleTicketingMemberAddMessage",
    },
    {
      method: "POST",
      path: "/member/tickets/:ticketId/reopen",
      handler: "handleTicketingMemberReopenTicket",
    },
    { method: "GET", path: "/tickets/:ticketId", handler: "handleTicketingOperatorGetTicket" },
    { method: "PATCH", path: "/tickets/:ticketId", handler: "handleTicketingOperatorPatchTicket" },
    {
      method: "POST",
      path: "/tickets/:ticketId/replies",
      handler: "handleTicketingOperatorReply",
    },
    {
      method: "POST",
      path: "/tickets/:ticketId/internal-notes",
      handler: "handleTicketingOperatorInternalNote",
    },
    {
      method: "POST",
      path: "/tickets/:ticketId/reopen",
      handler: "handleTicketingOperatorReopenTicket",
    },
  ],
} as const;
