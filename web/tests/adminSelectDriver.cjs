/** Exercise the same visible combobox/option controls as the operator. */
module.exports.installAdminSelectDriver = page => {
  const prototype = Object.getPrototypeOf(page.locator('select'));
  if (prototype.spotlogSelectDriver) return;
  const nativeSelect = prototype.selectOption;
  prototype.selectOption = async function(values, options) {
    if (await this.getAttribute('role') !== 'combobox') return nativeSelect.call(this, values, options);
    const target = Array.isArray(values) ? values[0] : values, native = this.locator('..').locator('select');
    const wanted = typeof target === 'string' ? target : target.value ?? await native.locator('option').evaluateAll((list, choice) => choice.label !== undefined ? list.find(option => option.label === choice.label)?.value : list[choice.index]?.value, target);
    await this.click();
    await this.page().locator('.admin-select-popup').locator(`[role="option"][data-value=${JSON.stringify(wanted)}]`).click();
    return [wanted];
  };
  prototype.spotlogSelectDriver = true;
};
