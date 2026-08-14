// 用户名词表：形容词 + 名词，组合出 312×364 = 113,568 种，约 16.8 bits。
//
// 名词来自 dariusk/corpora（CC0）的 animals/common、objects/objects、foods/fruits、
// foods/vegetables，过滤条件：纯小写字母、3-8 字符，去掉复数形式、品牌名和几个拼进
// 用户名会显得奇怪的词。
//
// 形容词是手工挑选的，没有直接用 corpora 的 adjs.json —— 那份表里混着非形容词
// （confuse、prank、process）和一批负面或带冒犯色彩的词（diseased、razed、swarthy），
// 而用户名是要展示给别人看的，靠黑名单过滤这类词是打地鼠。手选的这份全部为正面或中性，
// 不涉及身体、暴力、疾病、族群和宗教。
//
// 两张表都存成空格分隔的长字符串，构建产物更小。注意每个分片结尾都带一个空格，
// 少了它跨行的两个词会被拼成一个 —— test 里有针对性的断言。

const RAW_ADJECTIVES =
  "amber ancient arctic ashen autumn azure balmy beaming bold bouncy brave brawny breezy " +
  "bright brisk bronze bubbly calm candid canny caramel cheerful chilly chipper civic " +
  "classic clever cloudy coastal cobalt cosmic cozy crafty creamy crimson crisp crystal " +
  "curious curly daring dawn dazzling deep dewy diligent downy dreamy driven dusky dusty " +
  "eager early earthy easy echoing elated electric elegant emerald endless epic eternal " +
  "ethereal exotic fabled fair famous fancy fearless feisty fertile fiery fleet floral " +
  "flowing fluent fluffy foamy fond formal fragrant free fresh frosty frozen gallant " +
  "gentle giant gifted gilded glad gleaming glossy golden graceful grand granite grassy " +
  "green groovy hardy hazel hazy hearty heroic hidden honest hopeful humble ideal indigo " +
  "inland ivory jade jaunty jolly jovial joyful jungle keen kind lasting lavender leafy " +
  "lean light lilac lively lofty logical lucid lucky lunar lush magenta magic maple marble " +
  "marine meadow mellow merry mighty mild mindful minty misty modern modest moonlit mossy " +
  "mystic native natural neat neon nifty nimble noble nordic novel oaken ocean olive opal " +
  "orange orbital ornate pastel patient peaceful pearly peppy perky pine placid playful " +
  "pleasant plucky polar polished prairie precise prime pristine private prompt proper " +
  "proud pure purple quaint quiet quirky radiant rapid rare ready refined regal restful " +
  "rich rising robust rocky rosy royal ruby rugged rustic sable sage sandy sapphire satin " +
  "scarlet seaside secret serene shady sharp sheer shiny silent silken silver simple " +
  "sincere sleek slick smart smiling smooth snappy snowy solar solid sonic soothing " +
  "sparkly speedy spicy spirited splendid spotted spring stable starry steady stellar " +
  "sterling still stormy striped strong sturdy sublime subtle summer sunlit sunny super " +
  "supreme sure swift tangy teal tender thankful thriving tidal tidy timely tiny topaz " +
  "tranquil trusty tundra twilight ultra unique upbeat urban valiant vast velvet verdant " +
  "vibrant vigilant violet vivid vocal warm watchful wavy waxen welcome western willing " +
  "windy winged winter wise witty wondrous wooded woolen worthy zany zealous zesty zippy"

const RAW_NOUNS =
  "aardvark acorn alpaca amaranth anise antelope ape apple apricot arugula avocado baboon " +
  "badger bag balloon banana bananas bandana baseball basil bat bear beaver bed beet bell " +
  "belt bilberry bison blouse boar bonesaw book bookmark bottle bow bowl box bracelet " +
  "bread broccoli brush buckle buffalo bull button cabbage camel camera canary candle " +
  "canteen canvas capybara car caraway card carrot carrots cat celeriac celery chain chair " +
  "chalk chard chayote cheetah cherry chicken chickpea chipmunk chives cilantro clock " +
  "clothes coconut comb computer cork corn couch cougar cow coyote crow crowbar cucumber " +
  "cup currant dagger daikon damson date deer delicata desk dill dingo dog dolphin donkey " +
  "door dove drawer durian egg eggplant elephant elk endive eraser ewe feather feijoa " +
  "fennel ferret fig finch fish flag floor flowers food football fork fox fridge frisee " +
  "frog garlic gazelle ginger giraffe glass glasses gnu goat gopher gorilla grape guava " +
  "habanero hammer hamster hanger hedgehog helmet hog honeydew horse house hyena ibex " +
  "iguana impala ipod jackal jaguar jalapeno jambul jicama jujube kale kangaroo key " +
  "keyboard keychain keys knife koala kohlrabi kumquat lace ladle lamb lamp lavender leek " +
  "legume lemon lemur leopard lettuce light lighter lime lion lizard llama locket loquat " +
  "lotion lychee lynx magazine magnet mamey mandrill mango map marble marjoram marmoset " +
  "milk mink mirror mole mongoose monitor monkey moose mouse mulberry mule mushroom " +
  "muskrat mustang necktie needle newt nopale notebook notepad novel nut ocarina ocelot " +
  "okra olive onion opossum orange oregano oryx otter outlet pail panda panther pants " +
  "papaya paper paprika parakeet parrot parsley parsnip pea peach pear pen pencil perfume " +
  "phone physalis pig pillow pinecone plate platypus plum pomelo porpoise potato puma " +
  "pumpkin purse quilt quince rabbit raccoon radio radish raisin ram rambutan rat reindeer " +
  "remote reptile rhino rhubarb ring rock rope rosemary rug rutabaga sage sailboat sandal " +
  "satsuma scallion scarf seal shallot shampoo shark shawl sheep shirt shoes shovel shrew " +
  "sidewalk skirret skunk slipper sloth snake soap socks sofa spatula speakers spinach " +
  "sponge spoon spring squash squirrel stick straw sword table tapir taro thimble thread " +
  "thyme tiger toad tomato towel tree trucks tubers turnip turtle tweezers umbrella vase " +
  "wallet walrus warthog wasabi watch water weasel whale whip whistle wildcat window " +
  "wishbone wolf wombat wrench yak yam zebra zipper zucchini"

/** @type {string[]} 形容词，全小写，3-8 字符 */
export const ADJECTIVES = RAW_ADJECTIVES.split(' ')

/** @type {string[]} 名词，全小写，3-8 字符 */
export const NOUNS = RAW_NOUNS.split(' ')
