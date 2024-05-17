To clean up the second array based on the `isIncluded` property of objects in the first array, you can follow these steps:

1. **Create a Set of Names from the First Array**: Only include names where `isIncluded` is `true`.
2. **Filter the Second Array**: Use the `filter` method to keep only those items in the second array that exist in the Set created from the first array.

Here's how you can implement this:

### Example Arrays

Assume we have two arrays of objects:

```javascript
const array1 = [
  { name: "mail name 1", mail: "mailname1@mail.com", isIncluded: true },
  { name: "mail name 2", mail: "mailname2@mail.com", isIncluded: false },
  { name: "mail name 3", mail: "mailname3@mail.com", isIncluded: true }
];

const array2 = [
  { name: "mail name 1", mail: "mailname1@mail.com", comsi: "mailname1" },
  { name: "mail name 2", mail: "mailname2@mail.com", comsi: "mailname2" },
  { name: "mail name 3", mail: "mailname3@mail.com", comsi: "mailname3" },
  { name: "mail name 4", mail: "mailname4@mail.com", comsi: "mailname4" }
];
```

### Implementation

1. **Create a Set of Names from `array1` where `isIncluded` is `true`**:
   - Use a `Set` to store the names from `array1` where `isIncluded` is `true`.

2. **Filter `array2`**:
   - Use the `filter` method to keep only those items whose `name` exists in the `Set` from `array1`.

#### Code Implementation

```javascript
// Create a Set of names from the first array where isIncluded is true
const includedNames = new Set(array1.filter(item => item.isIncluded).map(item => item.name));

// Filter the second array to keep only items whose name exists in the Set
const cleanedArray2 = array2.filter(item => includedNames.has(item.name));

console.log(cleanedArray2);
```

### Explanation

1. **Filtering and Mapping `array1` to a Set**:
   - `array1.filter(item => item.isIncluded)` filters the items in `array1` where `isIncluded` is `true`.
   - `.map(item => item.name)` creates an array of names from the filtered items.
   - `new Set(array1.filter(item => item.isIncluded).map(item => item.name))` creates a `Set` from this array, allowing for efficient lookup.

2. **Filtering `array2`**:
   - `array2.filter(item => includedNames.has(item.name))` iterates over each item in `array2` and includes it in `cleanedArray2` only if `includedNames` contains the `name` of the item.

### Result

After running the above code, `cleanedArray2` will be:

```javascript
[
  { name: "mail name 1", mail: "mailname1@mail.com", comsi: "mailname1" },
  { name: "mail name 3", mail: "mailname3@mail.com", comsi: "mailname3" }
]
```

### Full Example

Here’s the complete example in one block:

```javascript
const array1 = [
  { name: "mail name 1", mail: "mailname1@mail.com", isIncluded: true },
  { name: "mail name 2", mail: "mailname2@mail.com", isIncluded: false },
  { name: "mail name 3", mail: "mailname3@mail.com", isIncluded: true }
];

const array2 = [
  { name: "mail name 1", mail: "mailname1@mail.com", comsi: "mailname1" },
  { name: "mail name 2", mail: "mailname2@mail.com", comsi: "mailname2" },
  { name: "mail name 3", mail: "mailname3@mail.com", comsi: "mailname3" },
  { name: "mail name 4", mail: "mailname4@mail.com", comsi: "mailname4" }
];

// Create a Set of names from the first array where isIncluded is true
const includedNames = new Set(array1.filter(item => item.isIncluded).map(item => item.name));

// Filter the second array to keep only items whose name exists in the Set
const cleanedArray2 = array2.filter(item => includedNames.has(item.name));

console.log(cleanedArray2);
```

This approach ensures that `array2` only contains items that are also in `array1` and have `isIncluded` set to `true`.
