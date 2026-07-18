import { defineSandbox } from "eve/sandbox";
import { programmableJustbash } from "./lib/programmable-justbash";

export default defineSandbox({
  backend: programmableJustbash(),
});
