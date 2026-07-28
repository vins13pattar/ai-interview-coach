# Synthetic Calibration Demonstration

> This report proves the annotation-import and metric-computation workflow. Its
> labels are derived from engineering fixture ranges, not qualified reviewers.
> It must not be cited as expert calibration or hiring validity.

| Dimension      |     MAE | Spearman | Weighted kappa | Over-score rate | Under-score rate |
| -------------- | ------: | -------: | -------------: | --------------: | ---------------: |
| confidence     | 17.8462 |   0.7856 |         0.1382 |          0.6923 |           0.1538 |
| communication  |      16 |   0.3973 |         0.1076 |          0.4231 |           0.4231 |
| technicalDepth | 14.7692 |   0.6998 |         0.4267 |          0.6923 |           0.1923 |

| Additional metric   | Result |
| ------------------- | -----: |
| Matched cases       |    156 |
| Evidence precision  | 0.0577 |
| Evidence recall     | 0.1154 |
| Follow-up agreement | 0.3462 |

Role-family slices and the full machine-readable result are stored in
`evaluation/results/synthetic-calibration-v1.json`. Replace the synthetic
annotation file with anonymized qualified-reviewer imports before making any
calibration claim.
