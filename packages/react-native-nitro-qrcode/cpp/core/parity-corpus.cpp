#include "parity-corpus.hpp"
namespace NitroQRCode {
const std::vector<ParityCorpusEntry>& parityCorpus() {
  static const std::vector<ParityCorpusEntry> entries = {
    {"Hello, world!", "M", 1, 40, -1, true, 21, "/gv8EpBurrt1BdusrsF5B/qv4BQAvnPgzGdEu5zKes3osIBD4/m80FWuut6d1Q4uvskEWc/tKQA="},
    {"hello, world!", "M", 1, 40, 0, true, 21, "/hP8FNBukrt0JdusrsEVB/qv4AcAqnCRKYTfm38RAixkiAB93/gy8EYguv0V0e2utisEYS/vEYA="},
    {"payment invoice number", "M", 1, 40, -1, true, 25, "/v2/wR4QboyLt1nV26k67BdhB/qq/gEHAIv4fMwzhbf/TIoJLUB6ByxjfnDdbAgYZcbTCPqAcka/uSqQSRF7q2+901u+6f2VBKpG/q1PgA=="},
    {"héllo wörld, 你好", "M", 1, 40, 6, true, 25, "/ra/wVfQbrJLt0Wl26gi7BEdB/qq/gDxAJ+xy+IhoDaYDEcV2MXiu9+nCjedfr0gID2S4v8Abka/vCuwXVG7rv/d1xeu6ClvBIQH/qb8gA=="},
    {"01234567890123456789012345678901234567890123456789", "M", 1, 40, -1, true, 25, "/sW/wQkQbrSLt0Tl26Mi7BchB/qq/gAqAKM2krbe4kflZTEV9WM1EEqJJqMJVhByyTzbPv2AREQ/s+rQQxGLoH/l0iGy6sOXBErG/rz1gA=="},
    {"HELLO WORLD 12345 $%*+-./:", "M", 1, 40, 1, true, 25, "/iC/wSbQboULt1Q126Wi7BZ5B/qq/gGKAGI8NCQo9yKhptU+QDS5eyum9G9viKQbn7D7BP2AVUf/jurwRLHro//l0Pki6zC/BYIN/kzrgA=="},
    {"fixed version number", "M", 10, 10, 2, true, 57, "/t5bEbBPP8FX/IiSnJButVWMFc/Lt0EoTfpepdulpOv3e1LsFYg5FQeRB/qqqqqqqv4B5FbEnIkAOv2iPjsY87CztXbbJqKc/cwOwE4KBSONyszkIae6njjMb9wiAt16Ra1kE5zHHOKL/36QphgcnKnlyhuDwdsGr+iy573rKr5Z9H3NYEkCRC9ti8w0Yod4pLgcR/ykYqBynYFU66yzCvaX9yEAuyUbvGnIhhoMwdthMg48oq/vGvO7918volh+nR/tzFUEUeyphL6sUfqExnCRFkNUa39CK/21c+Fj5yFjXmouglhKv8rgFBRnibLn2iU6lEO0vDgn/j7ij1kJSV+9jKWu0Xh85rD4l0Jaq7wjqgVU1gAbBbF+ImSqM7Arx/znsgx77YVQ2YU6ygGlKzlX4D/vnD7KlVKpnK60sEH5ZLr+mnKFKp0gtmGEiwHwiT8P7kRKAzfIvrr/+gBKj/HD1UV/kgFq+j9rkEOT/H46sVuuZBvsgB/912cyfnav0us+uc+UgpkElyl57of0/i/EoTSehwA="},
    {"masked", "M", 1, 40, 3, true, 21, "/lP8EtBukrt0RdutLsEpB/qv4BwAM76HQ8lJkmcZiI3lTYBmI/v7kEUtuhl91oGupJEE6h/gmgA="},
    {"boost off", "M", 1, 40, -1, false, 21, "/oP8ExBumrt19dusrsFpB/qv4BsAi7fKitaMtKxyiBY62YBFa/oq0E8yupZV0sXulOkEzw/o9IA="},
    {"high error correction level", "H", 1, 40, 4, true, 33, "/jiTP8FUJhBuivvrt0XxJdukmYLsFX2dB/qqqv4BmFkAD2IXsR77rase6kXBRRgmvTkqxZMHAUhaK7urjbRBo/x7q37e60yN9aiPx5dZXAx9pCax3mCNTGwHkKo6pvwQEq474uRO+YBZlkS/qU4qUFgXURuqjy+d0g6nZulcvLkE6WXU/heBioA="},
    {"boost tiny", "L", 1, 40, -1, true, 21, "/qP8ExBuqrt1NdukrsFJB/qv4BAAV7dr4f39uNLg1qklGIBLF/sOUFMjulBV1yzulbMF8w/gGQA="},
    {"boost tiny", "L", 1, 40, -1, false, 21, "/sv8ElBuqrt1JduuLsEBB/qv4AwA8qTtil5e+85DUby9IABy0/kfkEOtulQl1DCuvVEFNB/t3gA="},
    {"THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG", "M", 1, 40, 5, true, 73, "/iNqQtbaZXa/wX1lkpgog/cQbrbEDH4PCdsLt1AJ7tdBlX/l26VxL/41+8Da7BHhdGcPxzqRB/qqqqqqqqqq/gHpGxMk8RIpAIKkcPkhv9Tl52gjaHD3TPQhpc7iLiihXnAKGhExsUn8jTSD5IHgBQ9gLclUpQYjn7u1GlTIevE5bF0vQNRezpHwpIwVs5oOg3pnma3g2kOZCtZEVRsPegqdw87qwHWJT8SztX/8pjnS8pjlrrN661NXvmlLLDr/TLivFkP9czhcOYWxWS/XGT9mGuz178jnqbKbL7t7/gLPkgz5nFHNR1GsXqvFOrktavQKsGfqCxEqcWc7F/0RaviUn6W/+RGvg8Rr6e0zIVB6cpil16RQ8VkU1vvGWCMm3VBLxDajVWkpMFxsMarr/GA7wnQtD7+O3SSHPrROM9Ejvhq/lrYTcDkrWUtMtl0C6F5snuPvZ8vrmV6e+l7zgkWPRgNCHJbnQqRCTqdDXvniy25faUhAmmmKnzpO0843m7yqYw06j+XymVCq8qj+bTRL+c0ftvH8yQ/7R7dEUo9H41RM6hTWuWuqcOq/sVe/F0SRRBUXz/jg/JffwDb52DGq5aKOvrXYLNZBiE1CvJA1o5MH6Gf61qROhrllV+f/uLDVyoxj8z4Bdep/3C2uaXxAnGj3T5LF+L8omCIbyfvbMkMFoMz1XeJt9Q/FX/wlABeKXkqg1hQOf+sfhpF0SCSD4U7lNkNJfBlUu5zmjgE6KOTIeLNfmcTE1E5ezVIybauPgq4OAsiKfOr+y0+bDP6AbATFvgxe40b/htEq64airWvwQsZxIbkZKhF7pccf3/n9SB/90CMHRgvrYxoW6fjAxwvaEK/nBFU6xNjQxLxI/r4LHxJbcS6BgA=="},
  };
  return entries;
}
} // namespace NitroQRCode
