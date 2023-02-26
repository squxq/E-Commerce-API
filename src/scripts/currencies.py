# the point of this file is to analyze tabular data of currencies and write a csv file in the end
# every data["Currency"] contains a 1 except the ones that dont need it
import pandas as pd

data = pd.read_excel("data/currencies.xlsx", index_col = None)

subunits = []
exponentArr = []
baseArr = []
tiedToArr = []

for i in range(len(data)):
    data["Currency"][i] = data["Currency"][i].replace("_x000D_\n", " ")
    if "tied to:" in data["Currency"][i]:
        if data["Currency"][i].split("tied to:")[1].strip() == "euro":
            tiedToArr.append("EUR")
        elif data["Currency"][i].split("tied to:")[1].strip() == "US dollar":
            tiedToArr.append("USD")
        elif data["Currency"][i].split("tied to:")[1].strip() == "Singapore dollar":
            tiedToArr.append("SGD")
        elif data["Currency"][i].split("tied to:")[1].strip() == "Indian rupee":
            tiedToArr.append("INR")
        elif data["Currency"][i].split("tied to:")[1].strip() == "New Zealand dollar":
            tiedToArr.append("NZD")
        elif data["Currency"][i].split("tied to:")[1].strip() == "Sterling pound":
            tiedToArr.append("GBP")
        elif data["Currency"][i].split("tied to:")[1].strip() == "Danish krone":
            tiedToArr.append("DKK")
        elif data["Currency"][i].split("tied to:")[1].strip() == "Australian dollar":
            tiedToArr.append("AUD")
        elif data["Currency"][i].split("tied to:")[1].strip() == "South African rand":
            tiedToArr.append("ZAR")
        elif data["Currency"][i].split("tied to:")[1].strip() == "Hong Kong dollar":
            tiedToArr.append("HKD")
        elif data["Currency"][i].split("tied to:")[1].strip() == "Sudanese pound":
            tiedToArr.append("SDG")
        
        data["Currency"][i] = data["Currency"][i].split("tied to:")[0].strip()
    else:
        tiedToArr.append(None)
    if "1" in data["Currency"][i]:
        value = "1" + data["Currency"][i].split("1", 1)[1]
        data["Currency"][i] = data["Currency"][i].replace(value, "").strip()
        subunit = value.strip()
        numbersArr = value.split("=")
        del numbersArr[0]
        if len(numbersArr) == 1:
            number = int(numbersArr[0].strip().split(" ", 1)[0].strip())
            scientificNotation = "{:.0e}".format(number)
            if scientificNotation[0] == "1":
                base = "10"
                exponent = str(scientificNotation.split("+", 1)[1])
            else:
                base = str(scientificNotation[0])
                exponent = str(int(scientificNotation.split("+", 1)[1]) + 1)
        else:
            base = []
            exponent = "1"
            for i in range(len(numbersArr)):
                base.append(str(numbersArr[i].strip().split(" ", 1)[0].strip()))
    else:
        subunit = "1 " + data["ISO"][i]
        base = None
        exponent = None
            
    baseArr.append(base)
    exponentArr.append(exponent)
    subunits.append(subunit)

data["Sub Units"] = subunits
data["Base"] = baseArr
data["Exponent"] = exponentArr
data["Tied To"] = tiedToArr

print(data)
data.to_csv("format_currencies.csv") 