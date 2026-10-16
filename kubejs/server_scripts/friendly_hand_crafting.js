// Hammer + plate recipes: 1 ingot per plate instead of 2.
// Drop into kubejs/server_scripts/ and run /reload.
ServerEvents.recipes(event => {
  const jobs = [];

  event.forEachRecipe({ type: 'minecraft:crafting_shaped' }, recipe => {
    const json = recipe.json;
    const result = json.get('result');
    if (!result.has('item')) return;
    const out = String(result.get('item').getAsString());
    if (!Item.of(out).hasTag('forge:plates')) return;

    // Expect exactly a hammer plus one material, with the material used more than once.
    const key = json.get('key');
    const symbols = key.keySet().toArray();
    if (symbols.length !== 2) return;
    const hammer = symbols.filter(s => String(key.get(s)).includes('hammer'))[0];
    const material = symbols.filter(s => s !== hammer)[0];
    if (!hammer || !material) return;
    if (String(json.get('pattern')).split(material).length < 3) return; // not repeated, already fine

    const toIngredient = j => (j.has('item') ? String(j.get('item').getAsString()) : '#' + j.get('tag').getAsString());
    jobs.push({
      id: String(recipe.getId()),
      out: Item.of(out, result.has('count') ? result.get('count').getAsInt() : 1),
      keys: { h: toIngredient(key.get(hammer)), I: toIngredient(key.get(material)) },
    });
  });

  jobs.forEach(job => {
    event.remove({ id: job.id });
    event.shaped(job.out, ['h', 'I'], job.keys).id(job.id);
  });

  console.info('[friendly_hand_crafting] rewrote ' + jobs.length + ' plate recipes');
});
