/**
 * @type {import('@markdoc/markdoc').Config['tags']}
 */
export default {
  verdict: {
    render: "Verdict",
    attributes: {
      status: { type: String, required: true },
      score: { type: String },
    },
  },
  control: {
    render: "Control",
    attributes: {
      name: { type: String, required: true },
      result: { type: String, required: true },
    },
  },
};
