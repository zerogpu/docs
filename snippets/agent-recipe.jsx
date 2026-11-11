/**
 * Invisible on the page: carries a recipe's goal, stack and check step for the Agent view
 * that agent-mode.js builds, so each recipe gets its own hand-off prompt.
 */
export const AgentRecipe = ({ goal, stack, verify }) => (
  <div className="zg-recipe" hidden data-goal={goal} data-stack={stack} data-verify={verify} />
);
